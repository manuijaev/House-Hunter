from rest_framework import generics, permissions, status
from django.conf import settings
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
from .models import House
from .serializers import HouseSerializer

# Import Firebase helper for real-time updates
try:
    from .firebase_helper import update_house_status_in_firebase
except ImportError:
    # Firebase helper not available, continue without it
    def update_house_status_in_firebase(*args, **kwargs):
        pass

# Public + Landlord view: List approved houses / Create new pending house
class HouseListCreateView(generics.ListCreateAPIView):
    serializer_class = HouseSerializer

    def get_permissions(self):
        # In dev, unblock auth to avoid 403s during setup
        if getattr(settings, 'DEBUG', False):
            return [permissions.AllowAny()]
        # Public can GET approved/vacant houses; auth required to POST (create)
        if self.request.method in ('GET',):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

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
        landlord_name = serializer.validated_data.get('landlord_name') or "Test Landlord"
        # Attach landlord identity from Firebase-authenticated user when available
        landlord_uid = getattr(getattr(self.request, 'user', None), 'uid', None)
        landlord_email = getattr(getattr(self.request, 'user', None), 'email', None)
        house = serializer.save(
            landlord_name=landlord_name,  # Replace with request.user.username once auth works
            approval_status='pending',
            landlord_uid=landlord_uid or serializer.validated_data.get('landlord_uid') or '',
            landlord_email=landlord_email or serializer.validated_data.get('landlord_email') or ''
        )
        
        # Broadcast initial status to Firebase for real-time updates
        landlord_id = str(house.landlord.id) if house.landlord else None
        update_house_status_in_firebase(
            house_id=house.id,
            approval_status='pending',
            is_vacant=house.is_vacant,
            landlord_id=house.landlord_uid or landlord_id,
            pending_reason='New listing awaiting admin review'
        )


# 🧩 Detailed view: Retrieve / Update / Delete (used by landlords)
class HouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = House.objects.all()
    serializer_class = HouseSerializer

    def get_permissions(self):
        # In dev, allow all to simplify local testing
        if getattr(settings, 'DEBUG', False):
            return [permissions.AllowAny()]
        # AllowAny to GET details; require auth to modify/delete
        if self.request.method in ('GET',):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def update(self, request, *args, **kwargs):
        """Override update to broadcast status changes to Firebase"""
        # Ensure partial updates without duplicating the 'partial' kwarg
        kwargs['partial'] = True
        # Fetch original for reason computation after response
        instance_before = self.get_object()
        prev_status = instance_before.approval_status
        prev_is_vacant = instance_before.is_vacant

        response = super().update(request, *args, **kwargs)

        if response.status_code == 200:
            house = self.get_object()
            landlord_id = str(house.landlord.id) if house.landlord else None
            pending_reason = getattr(house, 'pending_reason', '') or None
            update_house_status_in_firebase(
                house_id=house.id,
                approval_status=house.approval_status,
                is_vacant=house.is_vacant,
                landlord_id=landlord_id,
                pending_reason=pending_reason
            )

        return response



# 🧱 Landlord dashboard (show their own houses)
class LandlordHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    # In dev, allow access without auth; in prod require auth
    def get_permissions(self):
        if getattr(settings, 'DEBUG', False):
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        """
        Show all houses for landlord dashboard (they see all their houses with status badges).
        TODO: Filter by authenticated landlord when auth is implemented.
        """
        # Prioritize Firebase authenticated user
        request_user = getattr(self.request, 'user', None)
        uid = getattr(request_user, 'uid', None)
        if uid:
            return House.objects.filter(landlord_uid=uid)

        # Fallback to query parameter (useful in DEBUG/dev when auth is open)
        # Check multiple possible parameter names for landlord ID
        uid_param = (
            self.request.GET.get('landlord_uid') or
            self.request.GET.get('uid') or
            self.request.GET.get('landlordId') or
            self.request.GET.get('landlord_id')
        )

        if uid_param:
            # Filter by landlord_uid field in the database
            return House.objects.filter(landlord_uid=uid_param)

        # If we cannot determine landlord, return empty queryset
        return House.objects.none()


# 🛠️ Admin-only endpoints: Approve / Reject houses
@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def approve_house(request, house_id):
    try:
        house = House.objects.get(id=house_id)
        house.approval_status = 'approved'
        house.save()
        
        # Broadcast status change to Firebase for real-time updates
        landlord_id = str(house.landlord.id) if house.landlord else None
        update_house_status_in_firebase(
            house_id=house_id,
            approval_status='approved',
            is_vacant=house.is_vacant,
            landlord_id=landlord_id
        )
        
        return Response({'message': 'House approved successfully'}, status=status.HTTP_200_OK)
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def reject_house(request, house_id):
    try:
        house = House.objects.get(id=house_id)
        house.approval_status = 'rejected'
        house.save()
        
        # Broadcast status change to Firebase for real-time updates
        landlord_id = str(house.landlord.id) if house.landlord else None
        update_house_status_in_firebase(
            house_id=house_id,
            approval_status='rejected',
            is_vacant=house.is_vacant,
            landlord_id=landlord_id
        )
        
        return Response({'message': 'House rejected successfully'}, status=status.HTTP_200_OK)
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=status.HTTP_404_NOT_FOUND)


# 🕓 Admin dashboard: Pending houses
class PendingHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        """
        Only pending houses (for approval panel)
        """
        return House.objects.filter(approval_status='pending')
