from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()

@database_sync_to_async
def get_user(token_key):
    try:
        access_token = AccessToken(token_key)
        user_id = access_token.payload.get('user_id')
        if user_id:
            return User.objects.get(id=user_id)
    except (InvalidToken, TokenError, User.DoesNotExist):
        pass
    return AnonymousUser()

class JWTAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        # Get token from query parameters
        query_string = scope.get('query_string', b'').decode()
        token = None

        if query_string:
            params = dict(param.split('=') for param in query_string.split('&') if '=' in param)
            token = params.get('token')

        if token:
            scope['user'] = await get_user(token)
        else:
            scope['user'] = AnonymousUser()

        return await self.inner(scope, receive, send)

JWTAuthMiddlewareStack = lambda inner: JWTAuthMiddleware(inner)