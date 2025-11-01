from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from django.db.models import Q
from .models import House
from .serializers import HouseSerializer

class HouseListCreateView(generics.ListCreateAPIView):
    serializer_class = HouseSerializer
    permission_classes = [permissions.AllowAny]  # Temporary for testing
    
    def get_queryset(self):
        # Tenants only see approved houses
        queryset = House.objects.filter(approval_status='approved', is_vacant=True)
        
        # Search functionality
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) | 
                Q(location__icontains=search)
            )
        
        return queryset
    
    # 🎯 REPLACE the perform_create method with this:
    def perform_create(self, serializer):
        # Temporary: Create without user authentication
        serializer.save(
            landlord_name="Test Landlord",  # Will be replaced later
            approval_status='pending'
        )

class HouseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = House.objects.all()
    serializer_class = HouseSerializer
    permission_classes = [permissions.AllowAny]  # Temporary for testing

class LandlordHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [permissions.AllowAny]  # Temporary for testing
    
    def get_queryset(self):
        # For now, return all houses - we'll filter by user later
        return House.objects.all()

@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def approve_house(request, house_id):
    try:
        house = House.objects.get(id=house_id)
        house.approval_status = 'approved'
        house.save()
        return Response({'status': 'house approved'})
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=404)

@api_view(['POST'])
@permission_classes([permissions.IsAdminUser])
def reject_house(request, house_id):
    try:
        house = House.objects.get(id=house_id)
        house.approval_status = 'rejected'
        house.save()
        return Response({'status': 'house rejected'})
    except House.DoesNotExist:
        return Response({'error': 'House not found'}, status=404)

class PendingHousesView(generics.ListAPIView):
    serializer_class = HouseSerializer
    permission_classes = [permissions.IsAdminUser]
    
    def get_queryset(self):
        return House.objects.filter(approval_status='pending')