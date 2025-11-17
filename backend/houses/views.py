from rest_framework import generics, permissions, status
from django.conf import settings
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.db.models import Q
from .models import House, User
from .serializers import HouseSerializer


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
