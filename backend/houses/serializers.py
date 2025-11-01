from rest_framework import serializers
from .models import House

class HouseSerializer(serializers.ModelSerializer):
    # 🎯 MAKE ISVACANT WRITEABLE
    isVacant = serializers.BooleanField(required=False)
    
    # Your other read-only fields...
    monthlyRent = serializers.DecimalField(source='monthly_rent', max_digits=10, decimal_places=2, read_only=True)
    contactPhone = serializers.CharField(source='contact_phone', read_only=True)
    contactEmail = serializers.CharField(source='contact_email', read_only=True)
    landlordName = serializers.CharField(source='landlord_name', read_only=True)
    displayName = serializers.CharField(source='landlord_name', read_only=True)
    availableDate = serializers.DateField(source='available_date', read_only=True)
    
    class Meta:
        model = House
        fields = [
            'id', 'title', 'description', 'location', 'size',
            'monthlyRent', 'deposit', 'availableDate', 
            'images', 'landlord', 'landlordName', 'displayName',
            'isVacant', 'approval_status', 'created_at', 
            'contactPhone', 'contactEmail'
        ]
        read_only_fields = [
            'id', 'landlord', 'landlord_name', 'approval_status', 
            'created_at'
        ]

    # 🎯 ADD THIS METHOD TO HANDLE ISVACANT FIELD
    def update(self, instance, validated_data):
        # Handle isVacant field separately
        is_vacant = validated_data.pop('isVacant', None)
        if is_vacant is not None:
            instance.is_vacant = is_vacant
        
        # Update other fields
        return super().update(instance, validated_data)