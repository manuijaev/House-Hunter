import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Message, House, Payment

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.house_id = self.scope['url_route']['kwargs']['house_id']
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Get the house and verify user has permission to chat
        try:
            self.house = await self.get_house(self.house_id)
            if not await self.can_user_chat(self.user, self.house):
                await self.close()
                return
        except House.DoesNotExist:
            await self.close()
            return

        self.room_group_name = f'chat_{self.house_id}'

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Receive message from WebSocket
    async def receive(self, text_data):
        try:
            text_data_json = json.loads(text_data)
            message = text_data_json['message']

            # Determine receiver based on sender's role
            receiver_id = await self.get_receiver_id(text_data_json)

            if not receiver_id:
                return

            # Save message to database
            saved_message = await self.save_message(self.user.id, receiver_id, self.house_id, message)

            # Send message to both sender and receiver in the room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender_id': self.user.id,
                    'receiver_id': receiver_id,
                    'timestamp': saved_message.timestamp.isoformat(),
                    'message_id': saved_message.id,
                }
            )
        except Exception as e:
            print(f"Error in receive: {e}")

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        sender_id = event['sender_id']
        receiver_id = event['receiver_id']
        timestamp = event['timestamp']
        message_id = event['message_id']

        # Only send to users who should receive this message
        if self.user.id in [sender_id, receiver_id]:
            await self.send(text_data=json.dumps({
                'message': message,
                'sender_id': sender_id,
                'receiver_id': receiver_id,
                'timestamp': timestamp,
                'message_id': message_id,
            }))

    @database_sync_to_async
    def get_house(self, house_id):
        return House.objects.get(id=house_id)

    @database_sync_to_async
    def get_receiver_id(self, text_data_json):
        """Determine the receiver ID based on user role"""
        if self.user.role == 'tenant':
            return self.house.landlord.id
        else:  # landlord
            # For landlord, use the receiver_id from the message if provided
            receiver_id = text_data_json.get('receiver_id')
            if receiver_id:
                # Validate that the receiver has sent messages to this landlord for this house
                try:
                    has_conversation = Message.objects.filter(
                        house=self.house,
                        sender=receiver_id,
                        receiver=self.user
                    ).exists()
                    if has_conversation:
                        return receiver_id
                except:
                    pass
            # If no valid receiver_id provided, find the most recent tenant who messaged
            try:
                recent_message = Message.objects.filter(
                    house=self.house,
                    receiver=self.user
                ).order_by('-timestamp').first()
                if recent_message:
                    return recent_message.sender.id
            except:
                pass
        return None

    @database_sync_to_async
    def can_user_chat(self, user, house):
        """Check if user can participate in chat for this house"""
        if user.role == 'landlord':
            return house.landlord == user
        elif user.role == 'tenant':
            return house.approval_status == 'approved'
        return False

    @database_sync_to_async
    def save_message(self, sender_id, receiver_id, house_id, message):
        try:
            sender = User.objects.get(id=sender_id)
            receiver = User.objects.get(id=receiver_id)
            house = House.objects.get(id=house_id)

            return Message.objects.create(
                sender=sender,
                receiver=receiver,
                house=house,
                text=message
            )
        except Exception as e:
            print(f"Error saving message: {e}")
            return None


class FavoritesCleanupConsumer(AsyncWebsocketConsumer):
    """Consumer for handling real-time favorites cleanup when houses are deleted"""

    async def connect(self):
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Join the favorites cleanup group
        await self.channel_layer.group_add(
            'favorites_cleanup',
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave the favorites cleanup group
        await self.channel_layer.group_discard(
            'favorites_cleanup',
            self.channel_name
        )

    # Receive house deletion event from group
    async def houses_deleted(self, event):
        """Handle houses deleted event"""
        house_ids = event['house_ids']

        # Send the deleted house IDs to the client
        await self.send(text_data=json.dumps({
            'type': 'houses_deleted',
            'house_ids': house_ids
        }))


class PaymentStatusConsumer(AsyncWebsocketConsumer):
    """Consumer for real-time payment status updates"""

    async def connect(self):
        self.payment_id = self.scope['url_route']['kwargs']['payment_id']
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        # Verify that the user owns this payment
        try:
            payment = await self.get_payment(self.payment_id)
            if payment.user != self.user:
                await self.close()
                return
        except Payment.DoesNotExist:
            await self.close()
            return

        self.room_group_name = f'payment_{self.payment_id}'

        # Join payment-specific room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send current payment status immediately
        current_status = await self.get_payment_status(self.payment_id)
        if current_status:
            await self.send(text_data=json.dumps({
                'type': 'payment_status_update',
                'status': current_status
            }))

    async def disconnect(self, close_code):
        # Leave payment room group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # Receive payment status update from group
    async def payment_status_update(self, event):
        """Handle payment status update event"""
        status = event['status']

        # Send the status update to the client
        await self.send(text_data=json.dumps({
            'type': 'payment_status_update',
            'status': status
        }))

    @database_sync_to_async
    def get_payment(self, payment_id):
        return Payment.objects.get(id=payment_id)

    @database_sync_to_async
    def get_payment_status(self, payment_id):
        try:
            payment = Payment.objects.get(id=payment_id)
            return payment.status
        except Payment.DoesNotExist:
            return None


class PaymentCompletionConsumer(AsyncWebsocketConsumer):
    """Consumer for real-time payment completion notifications across all user's houses"""

    async def connect(self):
        self.user = self.scope.get('user')

        if not self.user or not self.user.is_authenticated:
            await self.close()
            return

        self.room_group_name = f'user_payments_{self.user.id}'

        # Join user-specific payment completion group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        print(f"🔗 User {self.user.id} connected to payment completion WebSocket")

    async def disconnect(self, close_code):
        # Leave user payment group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
        print(f"🔌 User {self.user.id} disconnected from payment completion WebSocket")

    # Receive payment completion event from group
    async def payment_completed(self, event):
        """Handle payment completion event"""
        house_id = event['house_id']
        payment_id = event['payment_id']

        print(f"💰 Sending payment completion notification to user {self.user.id} for house {house_id}")

        # Send the payment completion to the client
        await self.send(text_data=json.dumps({
            'type': 'payment_completed',
            'house_id': str(house_id),
            'payment_id': payment_id,
            'message': 'Payment completed successfully'
        }))