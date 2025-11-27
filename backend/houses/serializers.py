from rest_framework import serializers
from .models import House, Message

class HouseSerializer(serializers.ModelSerializer):
    # Writable aliases for frontend field names
    isVacant = serializers.BooleanField(source='is_vacant', required=False)
    monthlyRent = serializers.DecimalField(source='monthly_rent', max_digits=10, decimal_places=2, required=False)
    contactPhone = serializers.CharField(source='contact_phone', required=False, allow_blank=True)
    contactEmail = serializers.EmailField(source='contact_email', required=False, allow_blank=True)
    landlordName = serializers.CharField(source='landlord_name', required=False, allow_blank=True)
    displayName = serializers.CharField(source='landlord_name', required=False, allow_blank=True)
    landlordUsername = serializers.CharField(source='landlord.username', required=False, allow_blank=True)
    landlordId = serializers.IntegerField(source='landlord.id', required=False)
    availableDate = serializers.DateField(source='available_date', required=False, allow_null=True)
    pendingReason = serializers.CharField(source='pending_reason', required=False, allow_blank=True)
    landlordUid = serializers.CharField(source='landlord_uid', required=False, allow_blank=True)
    landlordEmail = serializers.EmailField(source='landlord_email', required=False, allow_blank=True)
    views = serializers.IntegerField(source='view_count', required=False, read_only=True)

    class Meta:
        model = House
        fields = [
            'id', 'title', 'description', 'location', 'exact_location', 'size',
            'monthlyRent', 'deposit', 'availableDate',
            'images', 'amenities', 'landlord', 'landlordName', 'displayName', 'landlordUsername', 'landlordId', 'landlordUid', 'landlordEmail',
            'isVacant', 'approval_status', 'pendingReason', 'created_at', 'updated_at',
            'contactPhone', 'contactEmail', 'views'
        ]
        read_only_fields = [
            'id', 'landlord',
            'approval_status', 'created_at'
        ]
    
    def update(self, instance, validated_data):
        # Compute changes and enforce approval workflow on edits
        original_is_vacant = instance.is_vacant
        original_values = {
            'title': instance.title,
            'description': instance.description,
            'location': instance.location,
            'exact_location': instance.exact_location,
            'size': instance.size,
            'monthly_rent': instance.monthly_rent,
            'deposit': instance.deposit,
            'available_date': instance.available_date,
            'images': instance.images,
            'amenities': instance.amenities,
            'contact_phone': instance.contact_phone,
            'contact_email': instance.contact_email,
        }

        # Support both naming conventions (extra safety)
        is_vacant_data = (
            validated_data.pop('is_vacant', None)
            or validated_data.pop('isVacant', None)
        )
        if is_vacant_data is not None:
            instance.is_vacant = is_vacant_data

        # Apply other fields
        instance = super().update(instance, validated_data)

        # Determine if we should flip to pending
        changed_fields = []
        for key, prev in original_values.items():
            curr = getattr(instance, key)
            if key == 'images':
                if (prev or []) != (curr or []):
                    changed_fields.append('images')
            else:
                if prev != curr:
                    changed_fields.append(key)

        pending_reason = ''
        if original_is_vacant != instance.is_vacant:
            if instance.is_vacant is False:
                pending_reason = 'Marked occupied by landlord'
            else:
                pending_reason = 'Marked vacant by landlord'

        elif changed_fields:
            # Human-friendly field names
            rename = {
                'monthly_rent': 'monthly rent',
                'available_date': 'available date',
                'contact_phone': 'contact phone',
                'contact_email': 'contact email',
            }
            pretty_fields = [rename.get(f, f).replace('_', ' ') for f in changed_fields]
            pending_reason = 'Edited fields: ' + ', '.join(pretty_fields)

        # If previously approved and something changed, revert to pending
        if instance.approval_status == 'approved' and (pending_reason or changed_fields):
            instance.approval_status = 'pending'
            instance.pending_reason = pending_reason
            instance.save(update_fields=['approval_status', 'pending_reason', 'is_vacant', 'updated_at'])

        # If vacancy changed, always provide a reason (even if not approved before)
        elif original_is_vacant != instance.is_vacant and pending_reason:
            instance.pending_reason = pending_reason
            instance.save(update_fields=['pending_reason', 'is_vacant', 'updated_at'])

        return instance

    def create(self, validated_data):
        """Accept both camelCase and snake_case from the frontend when creating."""
        # Merge snake_case values from initial_data if provided
        initial = getattr(self, 'initial_data', {}) or {}

        # Map alternative input keys → model fields
        alt_inputs = {
            'monthly_rent': ['monthly_rent', 'monthlyRent'],
            'deposit': ['deposit'],
            'available_date': ['available_date', 'availableDate'],
            'contact_phone': ['contact_phone', 'contactPhone'],
            'contact_email': ['contact_email', 'contactEmail'],
            'landlord_name': ['landlord_name', 'landlordName', 'displayName'],
            'landlord_uid': ['landlord_uid', 'landlordId'],
            'landlord_email': ['landlord_email', 'landlordEmail'],
            'is_vacant': ['is_vacant', 'isVacant'],
            'images': ['images'],
            'amenities': ['amenities'],
            'title': ['title'],
            'description': ['description'],
            'location': ['location'],
            'exact_location': ['exact_location', 'location'],  # Allow location to set exact_location
            'size': ['size'],
        }

        for model_key, candidates in alt_inputs.items():
            for key in candidates:
                if key in initial and initial[key] is not None and initial[key] != '':
                    # Coerce types for known numeric/boolean fields
                    if model_key in ('monthly_rent', 'deposit'):
                        try:
                            validated_data[model_key] = float(initial[key])
                        except Exception:
                            pass
                    elif model_key == 'is_vacant':
                        validated_data[model_key] = bool(initial[key])
                    else:
                        validated_data[model_key] = initial[key]
                    break

        # Default landlord_name fallback if none provided
        if not validated_data.get('landlord_name'):
            validated_data['landlord_name'] = 'Landlord'

        return super().create(validated_data)


class MessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.username', read_only=True)
    receiver_name = serializers.CharField(source='receiver.username', read_only=True)
    house_title = serializers.CharField(source='house.title', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_name', 'receiver', 'receiver_name',
            'house', 'house_title', 'text', 'timestamp', 'is_read'
        ]
        read_only_fields = ['id', 'timestamp']

