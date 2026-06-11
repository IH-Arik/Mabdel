from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

OTPPurpose = Literal["signup", "forgot_password"]


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120, examples=["Arik Hasan"])
    email: EmailStr = Field(examples=["arik@example.com"])
    password: str = Field(min_length=8, max_length=128, examples=["SecurePass2024!"])


class LoginRequest(BaseModel):
    email: EmailStr = Field(examples=["arik@example.com"])
    password: str = Field(min_length=8, max_length=128, examples=["SecurePass2024!"])


class SendOTPRequest(BaseModel):
    email: EmailStr
    purpose: OTPPurpose = "signup"


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8, examples=["1234"])
    purpose: OTPPurpose = "signup"

    @field_validator("code")
    @classmethod
    def validate_otp_code(cls, value: str) -> str:
        if not value.isdigit():
            raise ValueError("OTP code must contain digits only.")
        return value


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_token: str = Field(min_length=10)
    new_password: str = Field(min_length=8, max_length=128)
    confirm_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def validate_passwords_match(self) -> "ResetPasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("new_password and confirm_password must match.")
        return self


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=20)


class GoogleLoginRequest(BaseModel):
    id_token: str | None = Field(default=None, description="Google ID token from mobile app")


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    is_verified: bool
    auth_provider: str
    avatar_url: str | None = None
    date_of_birth: date | None = None
    country: str | None = None
    language_preference: str = "EN"
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
    reset_token: str | None = None
