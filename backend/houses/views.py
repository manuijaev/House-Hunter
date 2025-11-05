from rest_framework import generics, permissions, status
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

# 🏠 Public + Landlord view: List approved houses / Create new pending house
class HouseListCreateView(generics.ListCreateAPIView):
    serializer_class = HouseSerializer
    permission_classes = [permissions.AllowAny]  # TODO: switch to IsAuthenticated for landlords later

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
        house = serializer.save(
            landlord_name=landlord_name,  # Replace with request.user.username once auth works
            approval_status='pending'
        )
        
        # Broadcast initial status to Firebase for real-time updates
        landlord_id = str(house.landlord.id) if house.landlord else None
        update_house_status_in_firebase(
            house_id=house.id,
            approval_status='pending',
            is_vacant=house.is_vacant,
            landlord_id=landlord_id
        )


# 🧩 Detailed view: Retrieve / Update / Delete (used by landlords)
class HouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = House.objects.all()
    serializer_class = HouseSerializer
    permission_classes = [permissions.AllowAny]

    def update(self, request, *args, **kwargs):
        """Override update to broadcast status changes to Firebase"""
        # Ensure partial updates without duplicating the 'partial' kwarg
        kwargs['partial'] = True
        response = super().update(request, *args, **kwargs)

        if response.status_code == 200:
            house = self.get_object()
            landlord_id = str(house.landlord.id) if house.landlord else None
            update_house_status_in_firebase(
                house_id=house.id,
                approval_status=house.approval_status,
                is_vacant=house.is_vacant,
                landlord_id=landlord_id
            )

        return response



# 🧱 Landlord dashboard (show their own houses)
class LandlordHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [permissions.AllowAny]  # TODO: IsAuthenticated later

    def get_queryset(self):
        """
        Show all houses for landlord dashboard (they see all their houses with status badges).
        TODO: Filter by authenticated landlord when auth is implemented.
        """
        return House.objects.all()  # For now, return all houses


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
