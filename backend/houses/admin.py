from django.contrib import admin
from .models import House

@admin.register(House)
class HouseAdmin(admin.ModelAdmin):
    list_display = ['title', 'location', 'approval_status', 'landlord_name', 'created_at']
    list_filter = ['approval_status', 'is_vacant', 'created_at']
    search_fields = ['title', 'location', 'landlord_name']
    list_editable = ['approval_status']  # Allows quick editing in list view
    
    # Optional: Group fields in the edit form
    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'description', 'location', 'size')
        }),
        ('Pricing', {
            'fields': ('monthly_rent', 'deposit')
        }),
        ('Status', {
            'fields': ('approval_status', 'is_vacant', 'available_date')
        }),
        ('Contact Information', {
            'fields': ('contact_phone', 'contact_email', 'landlord_name')
        }),
        ('Media', {
            'fields': ('images', 'amenities')
        }),
    )