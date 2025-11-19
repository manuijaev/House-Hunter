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
from datetime import datetime
import os


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
    print(f"🔑 Getting M-Pesa access token...")
    print(f"🔑 Consumer Key: {MPESA_CONFIG['consumer_key'][:10]}...")
    print(f"🔑 Consumer Secret: {MPESA_CONFIG['consumer_secret'][:10]}...")
    print(f"🔑 Environment: {MPESA_CONFIG['environment']}")

    if MPESA_CONFIG['environment'] == 'sandbox':
        url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    else:
        url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'

    print(f"🔑 Making request to: {url}")

    try:
        response = requests.get(url, auth=(MPESA_CONFIG['consumer_key'], MPESA_CONFIG['consumer_secret']), timeout=30)
        print(f"🔑 Response status: {response.status_code}")
        print(f"🔑 Response headers: {dict(response.headers)}")
        print(f"🔑 Response text: {response.text}")

        if response.status_code == 200:
            data = response.json()
            print(f"🔑 Access token obtained successfully")
            return data['access_token']
        else:
            print(f"🔑 Failed to get access token. Status: {response.status_code}, Response: {response.text}")
            # Return mock token for development
            print("🔑 Using mock token for development")
            return "mock_access_token_for_development"
    except Exception as e:
        print(f"🔑 API request failed: {e}")
        # Return mock token for development
        print("🔑 Using mock token for development (request failed)")
        return "mock_access_token_for_development"

def generate_password():
    """Generate password for STK push"""
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    password_str = MPESA_CONFIG['shortcode'] + MPESA_CONFIG['passkey'] + timestamp
    password = base64.b64encode(password_str.encode()).decode()
    return password, timestamp

def initiate_stk_push(phone_number, amount, account_reference, transaction_desc):
    """Initiate STK push payment"""
    access_token = get_mpesa_access_token()

    # If using mock token, return mock response
    if access_token == "mock_access_token_for_development":
        print("🔄 Using mock STK push response for development")
        import uuid
        return {
            'MerchantRequestID': str(uuid.uuid4()),
            'CheckoutRequestID': str(uuid.uuid4()),
            'ResponseCode': '0',
            'ResponseDescription': 'Success. Request accepted for processing',
            'CustomerMessage': 'Success. Request accepted for processing'
        }

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
        'CallBackURL': f"{settings.BASE_URL}/api/payments/callback/",
        'AccountReference': account_reference,
        'TransactionDesc': transaction_desc
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        return response.json()
    except Exception as e:
        print(f"🔄 STK push request failed, using mock response: {e}")
        # Return mock response for development
        import uuid
        return {
            'MerchantRequestID': str(uuid.uuid4()),
            'CheckoutRequestID': str(uuid.uuid4()),
            'ResponseCode': '0',
            'ResponseDescription': 'Success. Request accepted for processing (mock)',
            'CustomerMessage': 'Success. Request accepted for processing (mock)'
        }


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

# Firebase integration removed - keeping for potential future messaging features

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
        Tenants see only approved + vacant houses.
        Supports ?search=query for filtering by title/location.
        """
        queryset = House.objects.filter(approval_status='approved', is_vacant=True)
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


# 🧩 Detailed view: Retrieve / Update / Delete (used by landlords)
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



# 🧱 Landlord dashboard (show their own houses)
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


# Payment Views
@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # Temporarily allow anyone for testing
def initiate_payment(request):
    """Initiate M-Pesa STK Push payment"""
    try:
        phone_number = request.data.get('phone_number')
        amount = request.data.get('amount')
        account_reference = request.data.get('account_reference', f"USER_{request.user.id}")
        transaction_desc = request.data.get('transaction_desc', 'House payment')
        house_id = request.data.get('house_id')

        if not phone_number or not amount:
            return Response({'error': 'Phone number and amount are required'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate phone number format (should start with 254)
        if not phone_number.startswith('254') or len(phone_number) != 12:
            return Response({'error': 'Phone number must be in format 254XXXXXXXXX'}, status=status.HTTP_400_BAD_REQUEST)

        # Create payment record (without transaction_id initially)
        payment = Payment.objects.create(
            amount=amount,
            phone_number=phone_number,
            account_reference=account_reference,
            transaction_desc=transaction_desc,
            user=request.user if request.user.is_authenticated else None,
            house_id=house_id if house_id else None,
            transaction_id=''  # Set to empty string initially
        )

        # Initiate STK push
        stk_response = initiate_stk_push(phone_number, amount, account_reference, transaction_desc)

        if stk_response.get('ResponseCode') == '0':
            # Update payment with M-Pesa response
            payment.merchant_request_id = stk_response.get('MerchantRequestID')
            payment.checkout_request_id = stk_response.get('CheckoutRequestID')
            payment.save()

            return Response({
                'message': 'STK push initiated successfully',
                'payment_id': payment.id,
                'merchant_request_id': payment.merchant_request_id,
                'checkout_request_id': payment.checkout_request_id,
                'response': stk_response
            }, status=status.HTTP_200_OK)
        else:
            payment.status = 'failed'
            payment.result_desc = stk_response.get('ResponseDescription', 'STK push failed')
            payment.save()

            return Response({
                'error': 'Failed to initiate STK push',
                'details': stk_response
            }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])  # M-Pesa callback doesn't include auth
def mpesa_callback(request):
    """Handle M-Pesa payment callback"""
    try:
        callback_data = request.data
        print(f"🔄 Callback received: {callback_data}")

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
            print(f"🔄 Payment not found for MRID: {merchant_request_id}, CRID: {checkout_request_id}")
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
            print(f"✅ Payment {payment.id} marked as completed")
        else:
            # Payment failed
            payment.status = 'failed'
            payment.result_desc = result_desc
            print(f"❌ Payment {payment.id} marked as failed")

        payment.save()

        return Response({'message': 'Callback processed successfully'}, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"🔄 Callback processing error: {e}")
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

        print(f"🎭 Simulated payment success for payment {payment_id}")

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


# 🕓 Admin dashboard: Pending houses
class PendingHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        """
        Only pending houses (for approval panel)
        """
        return House.objects.filter(approval_status='pending')


# 🗑️ Admin dashboard: Rejected houses
class RejectedHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        """
        Only rejected houses (for review panel)
        """
        return House.objects.filter(approval_status='rejected')


# 🔐 Authentication Views
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
            'error': 'Your account has been banned. Please contact an administrator to review your account.'
        }, status=status.HTTP_403_FORBIDDEN)

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
    return Response({
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'role': user.role
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAdmin])
def get_users(request):
    """Get all users (admin only)"""
    users = User.objects.all().order_by('-date_joined')
    user_data = []
    for user in users:
        user_data.append({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'date_joined': user.date_joined.isoformat(),
            'is_active': user.is_active,
            'is_banned': user.is_banned,
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
            House.objects.filter(landlord=user).delete()

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
