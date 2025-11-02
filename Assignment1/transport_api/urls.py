"""
URL configuration for transport_api app.
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from transport_api.views import (
    StopViewSet, RouteViewSet, 
    SpatialQueryViewSet, MapView, BlankMapView, ShapeViewSet
)

router = DefaultRouter()
router.register(r'stops', StopViewSet, basename='stop')
router.register(r'routes', RouteViewSet, basename='route')
router.register(r'spatial-queries', SpatialQueryViewSet, basename='spatial-query')
router.register(r'shapes', ShapeViewSet, basename='shape')

app_name = 'transport_api'

urlpatterns = [
    path('', MapView.as_view(), name='map'),
    path('blank/', BlankMapView.as_view(), name='blank_map'),
    path('api/', include(router.urls)),
    
    # API Schema and Documentation
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='transport_api:schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='transport_api:schema'), name='redoc'),
]
