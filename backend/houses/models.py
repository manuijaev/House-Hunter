from django.db import models
from django.contrib.auth.models import User

class House(models.Model):
    APPROVAL_STATUS = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    # Basic house information (from React form)
    title = models.CharField(max_length=200)
    description = models.TextField()
    location = models.CharField(max_length=200)
    
    # Pricing information (from React form)
    monthly_rent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    deposit = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    # Property specs (from React form)
    size = models.CharField(max_length=100, blank=True)
    
    # Images (store image URLs from React)
    images = models.JSONField(default=list)
    
    # Amenities (store amenity IDs from React)
    amenities = models.JSONField(default=list)
    
    # 🎯 MAKE LANDLORD OPTIONAL TEMPORARILY
    landlord = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    landlord_name = models.CharField(max_length=100, default='Landlord')
    # Firebase identity for landlord scoping
    landlord_uid = models.CharField(max_length=128, blank=True, default='')
    landlord_email = models.EmailField(blank=True)
    
    # Status fields
    is_vacant = models.BooleanField(default=True)
    approval_status = models.CharField(
        max_length=20, 
        choices=APPROVAL_STATUS, 
        default='pending'
    )
    # Reason why a house is pending (e.g., edited fields or vacancy change)
    pending_reason = models.TextField(blank=True, default='')
    
    # Availability (from React form)
    available_date = models.DateField(null=True, blank=True)
    
    # Contact info (from React form)
    contact_phone = models.CharField(max_length=15, blank=True)
    contact_email = models.EmailField(blank=True)
    exact_location = models.CharField(max_length=300, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.title} - {self.location}"

    class Meta:
        ordering = ['-created_at']