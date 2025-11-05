from rest_framework import serializers
from .models import House

class HouseSerializer(serializers.ModelSerializer):
    # Writable aliases for frontend field names
    isVacant = serializers.BooleanField(source='is_vacant', required=False)
    monthlyRent = serializers.DecimalField(source='monthly_rent', max_digits=10, decimal_places=2, required=False)
    contactPhone = serializers.CharField(source='contact_phone', required=False, allow_blank=True)
    contactEmail = serializers.EmailField(source='contact_email', required=False, allow_blank=True)
    landlordName = serializers.CharField(source='landlord_name', required=False, allow_blank=True)
    displayName = serializers.CharField(source='landlord_name', required=False, allow_blank=True)
    availableDate = serializers.DateField(source='available_date', required=False, allow_null=True)

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
            'id', 'landlord',
            'approval_status', 'created_at'
        ]
    
    def update(self, instance, validated_data):
        # Support both naming conventions (extra safety)
        is_vacant_data = (
            validated_data.pop('is_vacant', None)
            or validated_data.pop('isVacant', None)
        )
        if is_vacant_data is not None:
            instance.is_vacant = is_vacant_data

        return super().update(instance, validated_data)

