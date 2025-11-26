from rest_framework import generics, permissions, status
from django.conf import settings
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q
from .models import House, User, Message, Payment
from .serializers import HouseSerializer, MessageSerializer
import requests
import base64
import json
from datetime import datetime, timedelta
import os
import threading
import time
from django.db import transaction


# M-Pesa API Configuration
MPESA_CONFIG = {
    'consumer_key': os.getenv('MPESA_CONSUMER_KEY') or 'R171HNv82XVQ5RASoRFUTI2fJTfhATqptAi5FGwiiLZaluq',
    'consumer_secret': os.getenv('MPESA_CONSUMER_SECRET') or 'nGTfGfCbarOQOAO0EvXPQTcGZwEfDlv92ZnYp7N0GRGn20IaOyI27kuiGMd11G80',
    'shortcode': os.getenv('MPESA_SHORTCODE') or '174379',
    'passkey': os.getenv('MPESA_PASSKEY') or 'bfb279f9aa9bdbcf1f2b1e2102c12c2d7cf3813f4982f56d27c4178d0f82f8c1',
    'environment': os.getenv('MPESA_ENVIRONMENT', 'sandbox')
}

def get_mpesa_access_token():
    """Get OAuth access token from M-Pesa"""
    print(f"Getting M-Pesa access token...")
    print(f"Consumer Key: {MPESA_CONFIG['consumer_key'][:10]}...")
    print(f"Consumer Secret: {MPESA_CONFIG['consumer_secret'][:10]}...")
    print(f"Environment: {MPESA_CONFIG['environment']}")

    if MPESA_CONFIG['environment'] == 'sandbox':
        url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    else:
        url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'

    print(f"Making request to: {url}")

    try:
        response = requests.get(url, auth=(MPESA_CONFIG['consumer_key'], MPESA_CONFIG['consumer_secret']), timeout=30)
        print(f"Response status: {response.status_code}")
        print(f"Response headers: {dict(response.headers)}")
        print(f"Response text: {response.text}")

        if response.status_code == 200:
            data = response.json()
            print(f"Access token obtained successfully")
            return data['access_token']
        else:
            print(f"Failed to get access token. Status: {response.status_code}, Response: {response.text}")
            raise Exception(f"Failed to get access token: {response.text}")
    except Exception as e:
        print(f"API request failed: {e}")
        raise Exception(f"API request failed: {str(e)}")

def generate_password():
    """Generate password for STK push"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password_str = MPESA_CONFIG['shortcode'] + MPESA_CONFIG['passkey'] + timestamp
    password = base64.b64encode(password_str.encode()).decode()
    return password, timestamp

def initiate_stk_push(phone_number, amount, account_reference, transaction_desc):
    """Initiate STK push payment"""
    access_token = get_mpesa_access_token()

    password, timestamp = generate_password()

    if MPESA_CONFIG['environment'] == 'sandbox':
        url = 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
    else:
        url = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }

    payload = {
        'BusinessShortCode': MPESA_CONFIG['shortcode'],
        'Password': password,
        'Timestamp': timestamp,
        'TransactionType': 'CustomerPayBillOnline',
        'Amount': amount,
        'PartyA': phone_number,
        'PartyB': MPESA_CONFIG['shortcode'],
        'PhoneNumber': phone_number,
        'CallBackURL': os.getenv('MPESA_CALLBACK_URL', 'http://localhost:8000/api/payments/callback/'),
        'AccountReference': account_reference,
        'TransactionDesc': transaction_desc
    }

    response = requests.post(url, json=payload, headers=headers, timeout=30)
    return response.json()


def simulate_payment_success(payment_id):
    """Simulate payment success after 10 seconds for development"""
    def simulate():
        time.sleep(20)
        try:
            payment = Payment.objects.get(id=payment_id)
            if payment.status == 'pending':
                payment.status = 'completed'
                payment.mpesa_receipt_number = f'SIM{payment.id}'
                payment.result_desc = 'Payment completed successfully (simulated)'
                payment.save()

                # Broadcast payment status update via WebSocket
                from channels.layers import get_channel_layer
                from asgiref.sync import async_to_sync

                try:
                    channel_layer = get_channel_layer()

                    # Broadcast to specific payment WebSocket (existing)
                    async_to_sync(channel_layer.group_send)(
                        f'payment_{payment.id}',
                        {
                            'type': 'payment_status_update',
                            'status': 'completed'
                        }
                    )

                    # Broadcast to user's payment completion group (new)
                    if payment.user:
                        async_to_sync(channel_layer.group_send)(
                            f'user_payments_{payment.user.id}',
                            {
                                'type': 'payment_completed',
                                'house_id': payment.house.id if payment.house else None,
                                'payment_id': payment.id
                            }
                        )
                        print(f"Simulated payment completion for user {payment.user.id} for house {payment.house.id if payment.house else None}")

                    print(f"Simulated payment success for payment {payment_id}")
                except Exception as e:
                    print(f"Failed to broadcast simulated payment status: {e}")
        except Exception as e:
            print(f"Error in payment simulation: {e}")

    # Start simulation in background thread
    thread = threading.Thread(target=simulate)
    thread.daemon = True
    thread.start()


class IsLandlord(permissions.BasePermission):
    """Custom permission to only allow landlords to access certain views"""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'landlord'


class IsAdmin(permissions.BasePermission):
    """Custom permission to only allow admins to access certain views"""

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role == 'admin'


class IsOwnerOrAdmin(permissions.BasePermission):
    """Custom permission to only allow owners of an object or admins to edit it"""

    def has_object_permission(self, request, view, obj):
        # Allow GET for anyone
        if request.method in permissions.SAFE_METHODS:
            return True

        # Allow if user is admin
        if request.user and request.user.is_authenticated and request.user.role == 'admin':
            return True

        # Allow if user is the landlord of the house
        return obj.landlord == request.user


# Public + Landlord view: List approved houses / Create new pending house
class HouseListCreateView(generics.ListCreateAPIView):
    serializer_class = HouseSerializer

    def get_permissions(self):
        # Public can GET approved/vacant houses; landlords required to POST (create)
        if self.request.method in ('GET',):
            return [permissions.AllowAny()]
        return [IsLandlord()]

    def get_queryset(self):
        """
        Tenants see all approved houses.
        Admins see all houses.
        Supports ?search=query for filtering by title/location.
        """
        user = self.request.user
        if user.is_authenticated and user.role == 'admin':
            # Admins see all houses
            queryset = House.objects.all()
        else:
            # Tenants see all approved houses (not just vacant ones)
            queryset = House.objects.filter(approval_status='approved')

        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(location__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        """
        Landlord posts a house (auto set to pending until admin approves).
        """
        user = self.request.user
        if not user.is_authenticated:
            raise permissions.PermissionDenied("You must be logged in to create a house")

        if user.role != 'landlord':
            raise permissions.PermissionDenied("Only landlords can create houses")

        landlord_name = serializer.validated_data.get('landlord_name') or user.username
        house = serializer.save(
            landlord=user,
            landlord_name=landlord_name,
            approval_status='pending',
            landlord_uid=str(user.id),  # Use Django user ID
            landlord_email=user.email
        )


# Detailed view: Retrieve / Update / Delete (used by landlords)
class HouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = House.objects.all()
    serializer_class = HouseSerializer
    permission_classes = [IsOwnerOrAdmin]

    def update(self, request, *args, **kwargs):
        """Override update to broadcast status changes to Firebase"""
        # Ensure partial updates without duplicating the 'partial' kwarg
        kwargs['partial'] = True
        # Fetch original for reason computation after response
        instance_before = self.get_object()
        prev_status = instance_before.approval_status
        prev_is_vacant = instance_before.is_vacant

        response = super().update(request, *args, **kwargs)

        # Note: Firebase real-time updates removed - keeping for potential future use
        # if response.status_code == 200:
        #     house = self.get_object()
        #     # Update logic here if needed

        return response

    def destroy(self, request, *args, **kwargs):
        """Override destroy to broadcast house deletion for favorites cleanup"""
        house = self.get_object()
        house_id = house.id

        # Call parent destroy method
        response = super().destroy(request, *args, **kwargs)

        # Broadcast house deletion event for favorites cleanup
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                'favorites_cleanup',
                {
                    'type': 'houses_deleted',
                    'house_ids': [house_id]
                }
            )
        except Exception as e:
            print(f"Failed to broadcast house deletion: {e}")

        return response



# Landlord dashboard (show their own houses)
class LandlordHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [IsLandlord]

    def get_queryset(self):
        """
        Show all houses for landlord dashboard (they see all their houses with status badges).
        """
        user = self.request.user
        if not user.is_authenticated:
            return House.objects.none()

        if user.role != 'landlord':
            return House.objects.none()

        return House.objects.filter(landlord=user)


# 🛠️ Admin-only endpoints: Approve / Reject houses
@api_view(['POST'])
@permission_classes([IsAdmin])
def approve_house(request, house_id):
    try:
        house = House.objects.get(id=house_id)
        house.approval_status = 'approved'
        house.save()
        
        return Response({'message': 'House approved successfully'}, status=status.HTTP_200_OK)
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAdmin])
def reject_house(request, house_id):
    try:
        house = House.objects.get(id=house_id)
        house.approval_status = 'rejected'
        house.save()
        
        return Response({'message': 'House rejected successfully'}, status=status.HTTP_200_OK)
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


# Message Views
class MessageListCreateView(generics.ListCreateAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Get messages for the current user (sent or received)
        """
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(receiver=user)
        ).select_related('sender', 'receiver', 'house')

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)


class MessageDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        """
        Users can only access messages they sent or received
        """
        user = self.request.user
        return Message.objects.filter(
            Q(sender=user) | Q(receiver=user)
        ).select_related('sender', 'receiver', 'house')


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_house_messages(request, house_id):
    """
    Get all messages for a specific house between the current user and the other party
    """
    try:
        house = House.objects.get(id=house_id)
        user = request.user

        # Find the other user in the conversation (landlord or tenant)
        if user.role == 'landlord':
            # Landlord sees messages with any tenant for this house
            messages = Message.objects.filter(
                Q(house=house) & (Q(sender=user) | Q(receiver=user))
            ).select_related('sender', 'receiver', 'house').order_by('timestamp')
        else:
            # Tenant sees messages with the landlord for this house
            landlord = house.landlord
            if not landlord:
                return Response({'messages': []}, status=status.HTTP_200_OK)

            messages = Message.objects.filter(
                Q(house=house) & (
                    (Q(sender=user) & Q(receiver=landlord)) |
                    (Q(sender=landlord) & Q(receiver=user))
                )
            ).select_related('sender', 'receiver', 'house').order_by('timestamp')

        serializer = MessageSerializer(messages, many=True)
        return Response({'messages': serializer.data}, status=status.HTTP_200_OK)

    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def delete_conversation(request):
    """
    Delete all messages in a conversation between landlord and a specific tenant for a house
    """
    try:
        house_id = request.data.get('house_id')
        tenant_id = request.data.get('tenant_id')

        if not house_id or not tenant_id:
            return Response({'error': 'house_id and tenant_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Verify the user is the landlord of this house
        house = House.objects.get(id=house_id)
        if house.landlord != request.user:
            return Response({'error': 'You can only delete conversations for your own houses'}, status=status.HTTP_403_FORBIDDEN)

        # Delete all messages between landlord and this tenant for this house
        deleted_count = Message.objects.filter(
            Q(house=house) & (
                (Q(sender=request.user) & Q(receiver_id=tenant_id)) |
                (Q(sender_id=tenant_id) & Q(receiver=request.user))
            )
        ).delete()

        return Response({
            'message': f'Conversation deleted successfully. {deleted_count[0]} messages removed.',
            'deleted_count': deleted_count[0]
        }, status=status.HTTP_200_OK)

    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def send_message(request):
    """
    Send a message via HTTP (fallback for WebSocket)
    """
    try:
        message = request.data.get('message')
        receiver_id = request.data.get('receiver_id')
        house_id = request.data.get('house_id')

        if not message or not receiver_id or not house_id:
            return Response({'error': 'message, receiver_id, and house_id are required'}, status=status.HTTP_400_BAD_REQUEST)

        house = House.objects.get(id=house_id)
        receiver = User.objects.get(id=receiver_id)
        user = request.user

        # Check permissions
        if user.role == 'landlord':
            if house.landlord != user:
                return Response({'error': 'You can only send messages for your houses'}, status=status.HTTP_403_FORBIDDEN)
        elif user.role == 'tenant':
            if house.approval_status != 'approved':
                return Response({'error': 'House is not approved'}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({'error': 'Invalid user role'}, status=status.HTTP_403_FORBIDDEN)

        # Check if messaging is blocked between these users
        from .models import MessageBlock
        block_exists = MessageBlock.objects.filter(
            (Q(blocker=user) & Q(blocked=receiver)) |
            (Q(blocker=receiver) & Q(blocked=user))
        ).exists()

        if block_exists:
            return Response({'error': 'Messaging is blocked between these users'}, status=status.HTTP_403_FORBIDDEN)

        # Create message
        message_obj = Message.objects.create(
            sender=user,
            receiver=receiver,
            house=house,
            text=message
        )

        # Broadcast via WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f'chat_{house_id}',
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender_id': user.id,
                    'receiver_id': receiver_id,
                    'timestamp': message_obj.timestamp.isoformat(),
                    'message_id': message_obj.id,
                }
            )
        except Exception as e:
            print(f"Failed to broadcast message: {e}")

        return Response({'message': 'Message sent successfully', 'message_id': message_obj.id}, status=status.HTTP_201_CREATED)

    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)
    except User.DoesNotExist:
        return Response({'error': 'Receiver not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Payment Views
@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Temporarily allow anyone for testing
def initiate_payment(request):
    """Initiate M-Pesa STK Push payment (simulated for development)"""
    try:
        phone_number = request.data.get('phone_number')
        amount = request.data.get('amount')
        account_reference = request.data.get('account_reference', f"USER_{request.user.id if request.user.is_authenticated else 'GUEST'}")
        transaction_desc = request.data.get('transaction_desc', 'House payment')
        house_id = request.data.get('house_id')

        if not phone_number or not amount:
            return Response({'error': 'Phone number and amount are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate phone number format (should start with 254)
        if not phone_number.startswith('254') or len(phone_number) != 12:
            return Response({'error': 'Phone number must be in format 254XXXXXXXXX'}, status=status.HTTP_400_BAD_REQUEST)

        # Get house instance if house_id provided
        house_instance = None
        if house_id:
            try:
                house_instance = House.objects.get(id=house_id)
            except House.DoesNotExist:
                return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)

        # Create payment record
        payment = Payment.objects.create(
            amount=amount,
            phone_number=phone_number,
            account_reference=account_reference,
            transaction_desc=transaction_desc,
            user=request.user if request.user.is_authenticated else None,
            house=house_instance,
            transaction_id=''  # Set to empty string initially
        )

        # Initiate STK push with real M-Pesa API
        try:
            stk_response = initiate_stk_push(phone_number, amount, account_reference, transaction_desc)
        except Exception as e:
            print(f"M-Pesa API error: {e}")
            payment.delete()  # Clean up the payment record
            return Response({'error': 'Payment service temporarily unavailable'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if stk_response.get('ResponseCode') == '0':
            # API success
            payment.merchant_request_id = stk_response.get('MerchantRequestID')
            payment.checkout_request_id = stk_response.get('CheckoutRequestID')
            payment.save()

            print(f"STK push successful for payment {payment.id} - phone: {phone_number}")

            # Simulate payment success after 10 seconds for development
            def simulate():
                import time
                time.sleep(6)
                try:
                    payment.status = 'completed'
                    payment.mpesa_receipt_number = f'SIM{payment.id}'
                    payment.result_desc = 'Payment completed successfully (simulated)'
                    payment.save()

                    # Mark house as rented (not vacant)
                    if payment.house:
                        payment.house.is_vacant = False
                        payment.house.save(update_fields=['is_vacant'])

                    # Broadcast payment status update via WebSocket
                    from channels.layers import get_channel_layer
                    from asgiref.sync import async_to_sync

                    try:
                        channel_layer = get_channel_layer()
                        async_to_sync(channel_layer.group_send)(
                            f'payment_{payment.id}',
                            {
                                'type': 'payment_status_update',
                                'status': 'completed'
                            }
                        )

                        # Broadcast house status update
                        if payment.house:
                            async_to_sync(channel_layer.group_send)(
                                'house_updates',
                                {
                                    'type': 'house_status_update',
                                    'house_id': payment.house.id,
                                    'is_vacant': False
                                }
                            )

                        print(f"Simulated payment completion for payment {payment.id}")
                    except Exception as e:
                        print(f"Failed to broadcast simulated payment: {e}")
                except Exception as e:
                    print(f"Error in payment simulation: {e}")

            import threading
            thread = threading.Thread(target=simulate)
            thread.daemon = True
            thread.start()

            return Response({
                'message': 'STK push initiated successfully',
                'payment_id': payment.id,
                'merchant_request_id': payment.merchant_request_id,
                'checkout_request_id': payment.checkout_request_id,
                'response': stk_response
            }, status=status.HTTP_200_OK)
        else:
            # API failed
            print(f"STK push failed: {stk_response.get('ResponseDescription')}")
            return Response({
                'error': f'STK push failed: {stk_response.get("ResponseDescription")}',
                'response': stk_response
            }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        print(f"Payment initiation error: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdmin])
def get_flagged_messages(request):
    """Get all flagged messages for admin review"""
    try:
        flagged_messages = Message.objects.filter(
            is_flagged=True
        ).select_related('sender', 'receiver', 'house', 'flagged_by').order_by('-flagged_at')

        messages_data = []
        for msg in flagged_messages:
            messages_data.append({
                'id': msg.id,
                'text': msg.text,
                'sender': msg.sender.username,
                'receiver': msg.receiver.username,
                'house_id': msg.house.id,
                'house_title': msg.house.title,
                'timestamp': msg.timestamp.isoformat(),
                'flag_reason': getattr(msg, 'flag_reason', ''),
                'flagged_by': msg.flagged_by.username if msg.flagged_by else 'Unknown',
                'flagged_at': msg.flagged_at.isoformat() if msg.flagged_at else None,
            })

        return Response({
            'flagged_messages': messages_data,
            'total_flagged': len(messages_data)
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Flagged messages error: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': f'Failed to fetch flagged messages: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_chat_monitoring(request):
    """Get all active conversations for admin monitoring"""
    try:
        from .models import MessageBlock
        # Get recent conversations (messages from last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)

        # Get all messages from the last 30 days
        recent_messages = Message.objects.filter(
            timestamp__gte=thirty_days_ago
        ).select_related('sender', 'receiver', 'house').order_by('-timestamp')

        # Group by house and user pairs
        conversations = {}
        total_conversations = 0

        for msg in recent_messages:
            # Create a unique key for each conversation
            user_pair = tuple(sorted([msg.sender.id, msg.receiver.id]))
            house_id = msg.house.id
            conv_key = f"{house_id}_{user_pair[0]}_{user_pair[1]}"

            if conv_key not in conversations:
                # Determine online status based on last_seen activity (within last 5 minutes)
                from django.utils import timezone
                current_time = timezone.now()

                def is_user_online(user):
                    if user.last_seen:
                        # Consider user online if active within last 5 minutes
                        time_diff = current_time - user.last_seen
                        return time_diff.total_seconds() < 300  # 5 minutes
                    return False

                conversations[conv_key] = {
                    'house_id': house_id,
                    'house_title': msg.house.title,
                    'participants': [
                        {
                            'id': msg.sender.id,
                            'username': msg.sender.username,
                            'role': msg.sender.role,
                            'is_banned': msg.sender.is_banned,
                            'is_online': is_user_online(msg.sender),
                            'messaging_blocked': False  # Will be updated below
                        },
                        {
                            'id': msg.receiver.id,
                            'username': msg.receiver.username,
                            'role': msg.receiver.role,
                            'is_banned': msg.receiver.is_banned,
                            'is_online': is_user_online(msg.receiver),
                            'messaging_blocked': False  # Will be updated below
                        }
                    ],
                    'messages': [],
                    'message_count': 0,
                    'last_message': None,
                    'flagged_messages': 0,
                    'spam_messages': 0
                }
                total_conversations += 1

            conv = conversations[conv_key]
            conv['messages'].append({
                'id': msg.id,
                'text': msg.text,
                'sender': msg.sender.username,
                'receiver': msg.receiver.username,
                'timestamp': msg.timestamp.isoformat(),
                'is_flagged': False,  # Default until migration
                'is_spam': False,     # Default until migration
                'flag_reason': ''
            })
            conv['message_count'] += 1

            # Update last message if this is more recent
            if conv['last_message'] is None or msg.timestamp > conv['last_message']['timestamp_dt']:
                conv['last_message'] = {
                    'text': msg.text,
                    'timestamp': msg.timestamp.isoformat(),
                    'timestamp_dt': msg.timestamp,
                    'sender': msg.sender.username
                }

        # Check messaging blocks for each conversation
        for conv in conversations.values():
            user1, user2 = conv['participants'][0]['id'], conv['participants'][1]['id']
            # Check if there's a block between these users
            block_exists = MessageBlock.objects.filter(
                (Q(blocker_id=user1) & Q(blocked_id=user2)) |
                (Q(blocker_id=user2) & Q(blocked_id=user1))
            ).exists()

            # Mark both participants as having blocked messaging if there's a block
            for participant in conv['participants']:
                participant['messaging_blocked'] = block_exists

        # Convert to list and sort by most recent
        conversation_list = list(conversations.values())
        conversation_list.sort(key=lambda x: x['last_message']['timestamp_dt'] if x['last_message'] else datetime.min, reverse=True)

        # Remove the timestamp_dt field from response
        for conv in conversation_list:
            if conv['last_message']:
                del conv['last_message']['timestamp_dt']

        return Response({
            'conversations': conversation_list,
            'total_conversations': total_conversations
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Chat monitoring error: {e}")
        import traceback
        traceback.print_exc()
        return Response({'error': f'Failed to fetch chat data: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdmin])
def flag_message(request, message_id):
    """Flag a message for moderation"""
    try:
        message = Message.objects.get(id=message_id)
        reason = request.data.get('reason', '')

        # Use setattr to handle fields that might not exist yet
        setattr(message, 'is_flagged', True)
        setattr(message, 'flag_reason', reason)
        setattr(message, 'flagged_by', request.user)
        setattr(message, 'flagged_at', datetime.now())
        message.save()

        return Response({
            'message': 'Message flagged successfully',
            'message_id': message_id
        }, status=status.HTTP_200_OK)

    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdmin])
def unflag_message(request, message_id):
    """Remove flag from a message"""
    try:
        message = Message.objects.get(id=message_id)

        setattr(message, 'is_flagged', False)
        setattr(message, 'flag_reason', '')
        setattr(message, 'flagged_by', None)
        setattr(message, 'flagged_at', None)
        message.save()

        return Response({
            'message': 'Message unflagged successfully',
            'message_id': message_id
        }, status=status.HTTP_200_OK)

    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@api_view(['POST'])
@permission_classes([IsAdmin])
def block_user_messaging(request, blocker_id, blocked_id):
    """Block messaging between two specific users"""
    try:
        blocker = User.objects.get(id=blocker_id)
        blocked = User.objects.get(id=blocked_id)

        from .models import MessageBlock
        block, created = MessageBlock.objects.get_or_create(
            blocker=blocker,
            blocked=blocked,
            defaults={'reason': request.data.get('reason', 'Blocked by admin')}
        )

        action = "created" if created else "already exists"

        return Response({
            'message': f'Messaging block {action} between {blocker.username} and {blocked.username}',
            'block_id': block.id,
            'created': created
        }, status=status.HTTP_200_OK)

    except User.DoesNotExist as e:
        return Response({'error': f'User not found: {str(e)}'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAdmin])
def unblock_user_messaging(request, blocker_id, blocked_id):
    """Unblock messaging between two specific users"""
    try:
        blocker = User.objects.get(id=blocker_id)
        blocked = User.objects.get(id=blocked_id)

        from .models import MessageBlock
        # Delete the block in both directions
        deleted_count = MessageBlock.objects.filter(
            (Q(blocker=blocker) & Q(blocked=blocked)) |
            (Q(blocker=blocked) & Q(blocked=blocker))
        ).delete()

        return Response({
            'message': f'Messaging unblocked between {blocker.username} and {blocked.username}',
            'deleted_count': deleted_count[0]
        }, status=status.HTTP_200_OK)

    except User.DoesNotExist as e:
        return Response({'error': f'User not found: {str(e)}'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




@api_view(['DELETE'])
@permission_classes([IsAdmin])
def delete_message(request, message_id):
    """Delete a message"""
    try:
        message = Message.objects.get(id=message_id)
        message.delete()

        return Response({
            'message': 'Message deleted successfully',
            'message_id': message_id
        }, status=status.HTTP_200_OK)

    except Message.DoesNotExist:
        return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # M-Pesa callback doesn't include auth
def mpesa_callback(request):
    """Handle M-Pesa payment callback"""
    try:
        callback_data = request.data
        print(f"Callback received: {callback_data}")

        # Extract callback metadata
        merchant_request_id = callback_data.get('Body', {}).get('stkCallback', {}).get('MerchantRequestID')
        checkout_request_id = callback_data.get('Body', {}).get('stkCallback', {}).get('CheckoutRequestID')
        result_code = callback_data.get('Body', {}).get('stkCallback', {}).get('ResultCode')
        result_desc = callback_data.get('Body', {}).get('stkCallback', {}).get('ResultDesc')

        # Find the payment record
        try:
            payment = Payment.objects.get(
                merchant_request_id=merchant_request_id,
                checkout_request_id=checkout_request_id
            )
        except Payment.DoesNotExist:
            print(f"Payment not found for MRID: {merchant_request_id}, CRID: {checkout_request_id}")
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)

        # Update payment status
        if result_code == 0:
            # Payment successful
            callback_metadata = callback_data.get('Body', {}).get('stkCallback', {}).get('CallbackMetadata', {}).get('Item', [])

            # Extract transaction details
            for item in callback_metadata:
                if item.get('Name') == 'MpesaReceiptNumber':
                    payment.mpesa_receipt_number = item.get('Value')
                elif item.get('Name') == 'TransactionDate':
                    # Could store transaction date if needed
                    pass
                elif item.get('Name') == 'PhoneNumber':
                    # Verify phone number matches
                    pass

            payment.status = 'completed'
            payment.result_desc = result_desc
            print(f"Payment {payment.id} marked as completed")
        else:
            # Payment failed
            payment.status = 'failed'
            payment.result_desc = result_desc
            print(f"Payment {payment.id} marked as failed")

        payment.save()

        # Broadcast payment status update via WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        try:
            channel_layer = get_channel_layer()

            # Broadcast to specific payment WebSocket (existing)
            async_to_sync(channel_layer.group_send)(
                f'payment_{payment.id}',
                {
                    'type': 'payment_status_update',
                    'status': payment.status
                }
            )

            # Broadcast to user's payment completion group (new)
            if payment.user:
                async_to_sync(channel_layer.group_send)(
                    f'user_payments_{payment.user.id}',
                    {
                        'type': 'payment_completed',
                        'house_id': payment.house.id if payment.house else None,
                        'payment_id': payment.id
                    }
                )
                print(f"Broadcasted payment completion to user {payment.user.id} for house {payment.house.id if payment.house else None}")

            print(f"Broadcasted payment status update for payment {payment.id}: {payment.status}")
        except Exception as e:
            print(f"Failed to broadcast payment status update: {e}")

        return Response({'message': 'Callback processed successfully'}, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Callback processing error: {e}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def simulate_payment_success(request):
    """Simulate payment success for development testing"""
    try:
        payment_id = request.data.get('payment_id')
        if not payment_id:
            return Response({'error': 'payment_id required'}, status=status.HTTP_400_BAD_REQUEST)

        payment = Payment.objects.get(id=payment_id)

        # Simulate successful payment
        payment.status = 'completed'
        payment.mpesa_receipt_number = f'MOCK{payment.id}'
        payment.result_desc = 'Payment completed successfully (simulated)'
        payment.save()

        # Broadcast payment status update via WebSocket
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        try:
            channel_layer = get_channel_layer()

            # Broadcast to specific payment WebSocket (existing)
            async_to_sync(channel_layer.group_send)(
                f'payment_{payment.id}',
                {
                    'type': 'payment_status_update',
                    'status': 'completed'
                }
            )

            # Broadcast to user's payment completion group (new)
            if payment.user:
                async_to_sync(channel_layer.group_send)(
                    f'user_payments_{payment.user.id}',
                    {
                        'type': 'payment_completed',
                        'house_id': payment.house_id,
                        'payment_id': payment.id
                    }
                )
                print(f"Broadcasted payment completion to user {payment.user.id} for house {payment.house_id}")

            print(f"Broadcasted payment completion for payment {payment.id}")
        except Exception as e:
            print(f"Failed to broadcast payment status update: {e}")

        print(f"Simulated payment success for payment {payment_id}")

        return Response({
            'message': 'Payment simulated successfully',
            'payment': {
                'id': payment.id,
                'status': payment.status,
                'mpesa_receipt_number': payment.mpesa_receipt_number
            }
        }, status=status.HTTP_200_OK)

    except Payment.DoesNotExist:
        return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def test_mpesa_config(request):
    """Test endpoint to check M-Pesa configuration"""
    print("=== MPESA CONFIG DEBUG ===")
    print(f"MPESA_CONSUMER_KEY: {os.getenv('MPESA_CONSUMER_KEY')}")
    print(f"MPESA_CONSUMER_SECRET: {os.getenv('MPESA_CONSUMER_SECRET')}")
    print(f"MPESA_SHORTCODE: {os.getenv('MPESA_SHORTCODE')}")
    print(f"MPESA_PASSKEY: {os.getenv('MPESA_PASSKEY')}")
    print(f"MPESA_ENVIRONMENT: {os.getenv('MPESA_ENVIRONMENT')}")
    print(f"MPESA_CONFIG dict: {MPESA_CONFIG}")
    print("=== END DEBUG ===")

    return Response({
        'consumer_key': MPESA_CONFIG['consumer_key'][:10] + '...' if MPESA_CONFIG['consumer_key'] else None,
        'consumer_secret': MPESA_CONFIG['consumer_secret'][:10] + '...' if MPESA_CONFIG['consumer_secret'] else None,
        'shortcode': MPESA_CONFIG['shortcode'],
        'passkey': MPESA_CONFIG['passkey'][:10] + '...' if MPESA_CONFIG['passkey'] else None,
        'environment': MPESA_CONFIG['environment'],
        'base_url': settings.BASE_URL,
        'debug': {
            'env_consumer_key': os.getenv('MPESA_CONSUMER_KEY'),
            'env_shortcode': os.getenv('MPESA_SHORTCODE'),
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user_payments(request):
    """Get payment history for authenticated user"""
    payments = Payment.objects.filter(user=request.user).order_by('-created_at')
    payment_data = []

    for payment in payments:
        payment_data.append({
            'id': payment.id,
            'amount': payment.amount,
            'phone_number': payment.phone_number,
            'account_reference': payment.account_reference,
            'transaction_desc': payment.transaction_desc,
            'status': payment.status,
            'mpesa_receipt_number': payment.mpesa_receipt_number,
            'result_desc': payment.result_desc,
            'created_at': payment.created_at.isoformat(),
            'house_id': payment.house.id if payment.house else None,
            'house_title': payment.house.title if payment.house else None
        })

    return Response({'payments': payment_data}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def increment_house_view(request, house_id):
    """
    Increment the view count for a house when viewed by a tenant
    """
    try:
        house = House.objects.get(id=house_id)
        house.view_count += 1
        house.save(update_fields=['view_count'])
        return Response({'view_count': house.view_count}, status=status.HTTP_200_OK)
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_valid_favorites(request):
    """Get user's favorites that still exist in the database"""
    user = request.user

    # Get user's favorites from localStorage (this would be sent from frontend)
    # For now, we'll return an empty list since favorites are stored client-side
    # In a production app, you'd want to store favorites server-side

    # For this implementation, we'll assume favorites are managed client-side
    # but we provide an endpoint to validate which houses still exist
    favorite_house_ids = request.query_params.getlist('house_ids[]', [])

    if not favorite_house_ids:
        return Response({'favorites': []}, status=status.HTTP_200_OK)

    # Filter to only houses that exist and are approved/vacant
    existing_houses = House.objects.filter(
        id__in=favorite_house_ids,
        approval_status='approved',
        is_vacant=True
    ).values_list('id', flat=True)

    valid_favorites = list(existing_houses)

    return Response({
        'favorites': valid_favorites,
        'total_count': len(valid_favorites)
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def mark_messages_read(request, house_id):
    """
    Mark all messages for a house as read for the current user
    """
    try:
        house = House.objects.get(id=house_id)
        user = request.user

        # Mark messages as read where user is the receiver
        Message.objects.filter(
            house=house,
            receiver=user,
            is_read=False
        ).update(is_read=True)

        return Response({'message': 'Messages marked as read'}, status=status.HTTP_200_OK)

    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


# Admin dashboard: Pending houses
class PendingHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        """
        Only pending houses (for approval panel)
        """
        return House.objects.filter(approval_status='pending')


# Admin dashboard: Rejected houses
class RejectedHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        """
        Only rejected houses (for review panel)
        """
        return House.objects.filter(approval_status='rejected')


# Authentication Views
@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def register(request):
    """Register a new user"""
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    role = request.data.get('role', 'tenant')  # Default to tenant

    if not username or not email or not password:
        return Response({'error': 'Username, email, and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({'error': 'Email already exists'}, status=status.HTTP_400_BAD_REQUEST)

    if role not in ['tenant', 'landlord', 'admin']:
        return Response({'error': 'Invalid role'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.create_user(username=username, email=email, password=password, role=role)
    refresh = RefreshToken.for_user(user)

    return Response({
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        },
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def login(request):
    """Login user and return JWT tokens"""
    username = request.data.get('username')
    password = request.data.get('password')

    if not username or not password:
        return Response({'error': 'Username and password are required'}, status=status.HTTP_400_BAD_REQUEST)

    # Try to authenticate with username first
    user = authenticate(username=username, password=password)

    # If authentication fails and username contains '@', try treating it as email
    if user is None and '@' in username:
        try:
            user_obj = User.objects.get(email=username)
            user = authenticate(username=user_obj.username, password=password)
        except User.DoesNotExist:
            pass

    if user is None:
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

    # Check if user is banned
    if user.is_banned:
        return Response({
            'error': 'Your account has been banned. Please contact an administrator for review.call 0726261857'
        }, status=status.HTTP_403_FORBIDDEN)

    # Set user as online
    user.is_online = True
    user.save(update_fields=['is_online'])

    refresh = RefreshToken.for_user(user)

    return Response({
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        },
        'tokens': {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def get_user(request):
    """Get current logged-in user info"""
    user = request.user

    # Update last_seen on user activity
    from django.utils import timezone
    user.last_seen = timezone.now()
    user.save(update_fields=['last_seen'])

    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def user_heartbeat(request):
    """Update user's last activity timestamp"""
    user = request.user
    from django.utils import timezone
    user.last_seen = timezone.now()
    user.save(update_fields=['last_seen'])

    return Response({'status': 'ok'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout(request):
    """Logout user and set as offline"""
    user = request.user
    user.is_online = False
    user.save(update_fields=['is_online'])

    return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def get_users(request):
    """Get all users (admin only)"""
    from django.utils import timezone
    users = User.objects.all().order_by('-date_joined')
    user_data = []
    now = timezone.now()

    for user in users:
        # Calculate online status based on last_seen (within last 5 minutes)
        is_online = False
        if user.last_seen:
            time_diff = (now - user.last_seen).total_seconds()
            is_online = time_diff < 300  # 5 minutes = 300 seconds

        user_data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'date_joined': user.date_joined.isoformat(),
            'is_active': user.is_active,
            'is_banned': user.is_banned,
            'is_online': is_online,
            'last_seen': user.last_seen.isoformat() if user.last_seen else None,
            'last_login': user.last_login.isoformat() if user.last_login else None
        })

    return Response(user_data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def ban_user(request, user_id):
    """Ban a user account (admin only)"""
    try:
        user = User.objects.get(id=user_id)
        user.is_banned = True
        user.save()

        return Response({'message': f'User {user.username} has been banned successfully'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([IsAdmin])
def unban_user(request, user_id):
    """Unban a user account (admin only)"""
    try:
        user = User.objects.get(id=user_id)
        user.is_banned = False
        user.save()

        return Response({'message': f'User {user.username} has been unbanned successfully'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([IsAdmin])
def delete_user(request, user_id):
    """Delete a user account (admin only)"""
    try:
        user = User.objects.get(id=user_id)

        # Prevent deleting admin accounts
        if user.role == 'admin':
            return Response({'error': 'Cannot delete admin accounts'}, status=status.HTTP_400_BAD_REQUEST)

        username = user.username

        # Delete all houses associated with this user if they are a landlord
        if user.role == 'landlord':
            # Get house IDs before deletion for cleanup
            house_ids = list(House.objects.filter(landlord=user).values_list('id', flat=True))
            House.objects.filter(landlord=user).delete()
    
            # Broadcast house deletion event for favorites cleanup
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
    
            try:
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    'favorites_cleanup',
                    {
                        'type': 'houses_deleted',
                        'house_ids': house_ids
                    }
                )
            except Exception as e:
                print(f"Failed to broadcast house deletion: {e}")

        user.delete()

        return Response({'message': f'User {username} has been deleted successfully'}, status=status.HTTP_200_OK)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['DELETE'])
@permission_classes([permissions.IsAuthenticated])
def delete_own_account(request):
    """Allow users to delete their own account"""
    user = request.user
    username = user.username

    # Prevent deleting admin accounts
    if user.role == 'admin':
        return Response({'error': 'Cannot delete admin accounts'}, status=status.HTTP_400_BAD_REQUEST)

    # Delete all houses associated with this user if they are a landlord
    if user.role == 'landlord':
        House.objects.filter(landlord=user).delete()

    user.delete()

    return Response({'message': f'Account {username} has been deleted successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAdmin])
def change_house_status(request, house_id):
    """Allow admins to change house status (approved/rejected houses can be modified)"""
    try:
        house = House.objects.get(id=house_id)

        if house.approval_status not in ['approved', 'rejected']:
            return Response({'error': 'Can only change status of approved or rejected houses'}, status=status.HTTP_400_BAD_REQUEST)

        new_status = request.data.get('status')
        if new_status not in ['pending', 'approved', 'rejected']:
            return Response({'error': 'Status must be pending, approved, or rejected'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent changing to the same status
        if new_status == house.approval_status:
            return Response({'error': f'House is already {new_status}'}, status=status.HTTP_400_BAD_REQUEST)

        house.approval_status = new_status
        house.pending_reason = request.data.get('reason', f'Changed to {new_status} by admin')
        house.save()

        return Response({'message': f'House status changed to {new_status} successfully'}, status=status.HTTP_200_OK)
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAdmin])
def admin_analytics(request):
    """Get comprehensive analytics data for admin dashboard"""
    from django.db.models import Count, Sum
    from django.db.models.functions import TruncMonth, TruncDay
    from datetime import datetime, timedelta

    try:
        # Revenue Analytics
        total_revenue = Payment.objects.filter(status='completed').aggregate(
            total=Sum('amount')
        )['total'] or 0

        # Monthly revenue trends (last 12 months)
        twelve_months_ago = datetime.now() - timedelta(days=365)
        monthly_revenue = Payment.objects.filter(
            status='completed',
            created_at__gte=twelve_months_ago
        ).annotate(
            month=TruncMonth('created_at')
        ).values('month').annotate(
            revenue=Sum('amount'),
            transactions=Count('id')
        ).order_by('month')

        # User Statistics
        total_users = User.objects.count()
        total_tenants = User.objects.filter(role='tenant').count()
        total_landlords = User.objects.filter(role='landlord').count()
        total_admins = User.objects.filter(role='admin').count()

        # User registration trends (last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        daily_registrations = User.objects.filter(
            date_joined__gte=thirty_days_ago
        ).annotate(
            day=TruncDay('date_joined')
        ).values('day').annotate(
            count=Count('id')
        ).order_by('day')

        # House Statistics
        total_houses = House.objects.count()
        approved_houses = House.objects.filter(approval_status='approved').count()
        pending_houses = House.objects.filter(approval_status='pending').count()
        rejected_houses = House.objects.filter(approval_status='rejected').count()

        # Popular Houses (by view count)
        popular_houses = House.objects.filter(
            approval_status='approved'
        ).order_by('-view_count')[:10].values(
            'id', 'title', 'view_count', 'landlord__username'
        )

        # Top Landlords (by number of approved houses)
        top_landlords = User.objects.filter(
            role='landlord'
        ).annotate(
            house_count=Count('house')
        ).filter(
            house__approval_status='approved'
        ).order_by('-house_count')[:10].values(
            'id', 'username', 'house_count'
        )

        # Payment Analytics
        total_payments = Payment.objects.count()
        successful_payments = Payment.objects.filter(status='completed').count()
        failed_payments = Payment.objects.filter(status='failed').count()
        pending_payments = Payment.objects.filter(status='pending').count()

        success_rate = (successful_payments / total_payments * 100) if total_payments > 0 else 0

        # Recent Activity (last 7 days)
        seven_days_ago = datetime.now() - timedelta(days=7)
        recent_registrations = User.objects.filter(date_joined__gte=seven_days_ago).count()
        recent_payments = Payment.objects.filter(created_at__gte=seven_days_ago).count()
        recent_houses = House.objects.filter(created_at__gte=seven_days_ago).count()

        analytics_data = {
            'revenue': {
                'total': total_revenue,
                'monthly_trends': list(monthly_revenue),
                'currency': 'KES'
            },
            'users': {
                'total': total_users,
                'tenants': total_tenants,
                'landlords': total_landlords,
                'admins': total_admins,
                'daily_registrations': list(daily_registrations)
            },
            'houses': {
                'total': total_houses,
                'approved': approved_houses,
                'pending': pending_houses,
                'rejected': rejected_houses
            },
            'popular_houses': list(popular_houses),
            'top_landlords': list(top_landlords),
            'payments': {
                'total': total_payments,
                'successful': successful_payments,
                'failed': failed_payments,
                'pending': pending_payments,
                'success_rate': round(success_rate, 2)
            },
            'recent_activity': {
                'registrations': recent_registrations,
                'payments': recent_payments,
                'houses': recent_houses,
                'period': '7 days'
            }
        }

        return Response(analytics_data, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Analytics error: {e}")
        return Response({'error': 'Failed to fetch analytics data'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
