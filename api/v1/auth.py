from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken


class AccessTokenRefreshView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        token = request.data.get('refresh')

        if not token:
            return Response(
                {'detail': 'Se requiere el refresh token.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            refresh = RefreshToken(token)
        except TokenError:
            return Response(
                {'detail': 'Refresh token inválido o expirado.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        return Response({'access': str(refresh.access_token)})
