import { prisma } from '@/config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '@/utils/password';
import { generateAccessToken, generateRefreshToken } from '@/utils/jwt';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  UserResponse,
  PasswordChangeRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest
} from '@/types/auth.types';
import { Role } from '@prisma/client';
import { logger } from '@/utils/logger';
import { ApiResponse } from '@/types/academic.types';

export class AuthService {
  async register(registerData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      const { username, email, password, confirmPassword } = registerData;
      // Public self-registration never grants elevated roles; ADMIN/DOSEN accounts
      // are created by an admin through the dosen/mahasiswa endpoints.
      const role = Role.MAHASISWA;

      // Validate passwords match
      if (password !== confirmPassword) {
        return {
          success: false,
          message: 'Passwords do not match',
          error: 'PASSWORD_MISMATCH'
        };
      }

      // Validate password strength
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: 'Password does not meet security requirements',
          error: 'WEAK_PASSWORD',
          data: { errors: passwordValidation.errors } as any
        };
      }

      // Check if username already exists
      const existingUsername = await prisma.user.findUnique({
        where: { username }
      });

      if (existingUsername) {
        return {
          success: false,
          message: 'Username already exists',
          error: 'USERNAME_EXISTS'
        };
      }

      // Check if email already exists
      const existingEmail = await prisma.user.findUnique({
        where: { email }
      });

      if (existingEmail) {
        return {
          success: false,
          message: 'Email already exists',
          error: 'EMAIL_EXISTS'
        };
      }

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash: hashedPassword,
          role
        },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      const refreshToken = generateRefreshToken({
        userId: user.id,
        username: user.username,
        type: 'refresh'
      });

      logger.info(`User registered successfully: ${username}`);

      return {
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      logger.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed',
        error: 'REGISTRATION_ERROR'
      };
    }
  }

  async login(loginData: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      const { username, password } = loginData;

      // Find user by username or email
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username },
            { email: username }
          ]
        },
        select: {
          id: true,
          username: true,
          email: true,
          passwordHash: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS'
        };
      }

      if (!user.isActive) {
        return {
          success: false,
          message: 'Account is deactivated',
          error: 'ACCOUNT_DEACTIVATED'
        };
      }

      // Verify password
      const isPasswordValid = await comparePassword(password, user.passwordHash);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid credentials',
          error: 'INVALID_CREDENTIALS'
        };
      }

      // Generate tokens
      const accessToken = generateAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      const refreshToken = generateRefreshToken({
        userId: user.id,
        username: user.username,
        type: 'refresh'
      });

      // Remove password hash from response
      const { passwordHash, ...userResponse } = user;

      logger.info(`User logged in successfully: ${username}`);

      return {
        success: true,
        message: 'Login successful',
        data: {
          user: userResponse,
          accessToken,
          refreshToken
        }
      };
    } catch (error) {
      logger.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed',
        error: 'LOGIN_ERROR'
      };
    }
  }

  async refreshToken(refreshToken: string): Promise<ApiResponse<{ accessToken: string; refreshToken: string }>> {
    try {
      const { verifyRefreshToken } = await import('@/utils/jwt');
      const payload = verifyRefreshToken(refreshToken);

      // Find user
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          username: true,
          role: true,
          isActive: true
        }
      });

      if (!user || !user.isActive) {
        return {
          success: false,
          message: 'Invalid refresh token',
          error: 'INVALID_REFRESH_TOKEN'
        };
      }

      // Generate new tokens
      const newAccessToken = generateAccessToken({
        userId: user.id,
        username: user.username,
        role: user.role
      });

      const newRefreshToken = generateRefreshToken({
        userId: user.id,
        username: user.username,
        type: 'refresh'
      });

      return {
        success: true,
        message: 'Tokens refreshed successfully',
        data: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      };
    } catch (error) {
      logger.error('Token refresh error:', error);
      return {
        success: false,
        message: 'Token refresh failed',
        error: 'TOKEN_REFRESH_ERROR'
      };
    }
  }

  async changePassword(userId: string, passwordData: PasswordChangeRequest): Promise<ApiResponse> {
    try {
      const { currentPassword, newPassword, confirmPassword } = passwordData;

      // Validate new passwords match
      if (newPassword !== confirmPassword) {
        return {
          success: false,
          message: 'New passwords do not match',
          error: 'PASSWORD_MISMATCH'
        };
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: 'New password does not meet security requirements',
          error: 'WEAK_PASSWORD',
          data: { errors: passwordValidation.errors } as any
        };
      }

      // Get user with current password
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      // Verify current password
      const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        return {
          success: false,
          message: 'Current password is incorrect',
          error: 'INVALID_CURRENT_PASSWORD'
        };
      }

      // Hash new password
      const hashedNewPassword = await hashPassword(newPassword);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash: hashedNewPassword }
      });

      logger.info(`Password changed successfully for user: ${userId}`);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      logger.error('Password change error:', error);
      return {
        success: false,
        message: 'Password change failed',
        error: 'PASSWORD_CHANGE_ERROR'
      };
    }
  }

  async getProfile(userId: string): Promise<ApiResponse<UserResponse>> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        return {
          success: false,
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Profile retrieved successfully',
        data: user
      };
    } catch (error) {
      logger.error('Get profile error:', error);
      return {
        success: false,
        message: 'Failed to retrieve profile',
        error: 'PROFILE_RETRIEVAL_ERROR'
      };
    }
  }

  async updateProfile(userId: string, updateData: { email?: string }): Promise<ApiResponse<UserResponse>> {
    try {
      const { email } = updateData;

      if (email) {
        // Check if email already exists
        const existingEmail = await prisma.user.findUnique({
          where: { email }
        });

        if (existingEmail && existingEmail.id !== userId) {
          return {
            success: false,
            message: 'Email already exists',
            error: 'EMAIL_EXISTS'
          };
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      logger.info(`Profile updated successfully for user: ${userId}`);

      return {
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser
      };
    } catch (error) {
      logger.error('Update profile error:', error);
      return {
        success: false,
        message: 'Failed to update profile',
        error: 'PROFILE_UPDATE_ERROR'
      };
    }
  }
}
