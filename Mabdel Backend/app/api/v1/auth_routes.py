from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordBearer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.database import get_database
from app.repositories.auth_repository import AuthRepository
from app.repositories.otp_repository import OTPRepository
from app.repositories.token_repository import TokenRepository
from app.schemas.auth_schema import (
    ForgotPasswordRequest,
    GoogleLoginRequest,
    LoginRequest,
    MessageResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendOTPRequest,
    TokenResponse,
    UserResponse,
    VerifyOTPRequest,
)
from app.schemas.common import ApiErrorResponse, ApiResponse
from app.services.auth_service import AuthService
from app.services.email_service import EmailService
from app.services.otp_service import OTPService
from app.utils.responses import success_response

router = APIRouter(prefix="/auth", tags=["Authentication"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_email_service() -> EmailService:
    return EmailService()


def get_otp_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
    email_service: EmailService = Depends(get_email_service),
) -> OTPService:
    return OTPService(otp_repository=OTPRepository(db), email_service=email_service)


def get_auth_service(
    db: AsyncIOMotorDatabase = Depends(get_database),
    otp_service: OTPService = Depends(get_otp_service),
) -> AuthService:
    return AuthService(
        auth_repository=AuthRepository(db),
        otp_service=otp_service,
        token_repository=TokenRepository(db),
    )


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=ApiResponse[MessageResponse],
    responses={409: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def register(payload: RegisterRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.register_user(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/login",
    response_model=ApiResponse[TokenResponse],
    responses={401: {"model": ApiErrorResponse}, 403: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def login(payload: LoginRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    tokens = await auth_service.login_user(payload)
    return success_response(data=tokens.model_dump(), message="Login successful.")


@router.post(
    "/send-otp",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}},
)
async def send_otp(payload: SendOTPRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.send_otp(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/resend-otp",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 404: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}},
)
async def resend_otp(payload: SendOTPRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.resend_otp(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/verify-otp",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def verify_otp(payload: VerifyOTPRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.verify_otp(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/forgot-password",
    response_model=ApiResponse[MessageResponse],
    responses={404: {"model": ApiErrorResponse}, 429: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def forgot_password(payload: ForgotPasswordRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.forgot_password(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/reset-password",
    response_model=ApiResponse[MessageResponse],
    responses={400: {"model": ApiErrorResponse}, 401: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def reset_password(payload: ResetPasswordRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.reset_password(payload)
    return success_response(data=result.model_dump(), message=result.message)


@router.post(
    "/refresh-token",
    response_model=ApiResponse[TokenResponse],
    responses={401: {"model": ApiErrorResponse}, 422: {"model": ApiErrorResponse}},
)
async def refresh_token(payload: RefreshTokenRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.refresh_access_token(payload)
    return success_response(data=result.model_dump(), message="Token refreshed successfully.")


@router.post(
    "/google",
    response_model=ApiResponse[TokenResponse],
    responses={400: {"model": ApiErrorResponse}, 401: {"model": ApiErrorResponse}, 503: {"model": ApiErrorResponse}},
)
async def google_login(payload: GoogleLoginRequest, auth_service: AuthService = Depends(get_auth_service)) -> dict:
    result = await auth_service.google_login(payload)
    return success_response(data=result.model_dump(), message="Google login successful.")


@router.get(
    "/me",
    response_model=ApiResponse[UserResponse],
    responses={401: {"model": ApiErrorResponse}},
)
async def me(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    user = await auth_service.get_current_user(token)
    return success_response(data=user.model_dump(), message="Current user fetched successfully.")


@router.post(
    "/logout",
    response_model=ApiResponse[MessageResponse],
    responses={401: {"model": ApiErrorResponse}},
)
async def logout(
    token: str = Depends(oauth2_scheme),
    auth_service: AuthService = Depends(get_auth_service),
) -> dict:
    result = await auth_service.logout(token)
    return success_response(data=result.model_dump(), message="Logged out successfully.")
