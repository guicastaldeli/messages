import { useEffect, useState } from "react";
import { PasswordResetProps } from "./_password-reset";
import { Step } from "./_password-reset";
import { PasswordReset } from "./_password-reset";
import { useSearchParams } from "next/navigation";

export interface TokenValidationResponse {
    valid: boolean;
    error?: string;
}

export interface PasswordResetRequestResponse {
    success: boolean;
    error?: string;
}

export interface PasswordResetResponse {
    success: boolean;
    message?: string;
    error?: string;
}

export const PasswordResetController: React.FC<PasswordResetProps> = ({
    apiClientController,
    socketClientConnect,
    onBackToLogin,
    token: propToken
}) => {
    const searchParams = useSearchParams();
    const urlToken = searchParams.get('token');
    const token = propToken || urlToken || '';

    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetToken, setResetToken] = useState(token || '');
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [step, setStep] = useState<Step>(Step.REQUEST);
    const [isValidatingToken, setIsValidatingToken] = useState(!!token);

    const passwordReset = {
        email,
        newPassword,
        confirmPassword,
        resetToken,
        isLoading: isLoading || isValidatingToken,
        message,
        error,
        step,
        setEmail,
        setNewPassword,
        setConfirmPassword,
        setResetToken,
        setIsLoading,
        setMessage,
        setError,
        setStep
    }

    useEffect(() => {
        if (token) {
            console.log("Token found, validating:", token);
            validateToken(token);
        } else {
            console.log("No token found, showing request form");
            setStep(Step.REQUEST);
        }
    }, [token]);

    /**
     * Validate Token
     */
    const validateToken = async (tokenToValidate: string) => {
        console.log("Starting token validation");
        setIsValidatingToken(true);
        setError('');
        setMessage('Validating your reset link...');
        
        try {
            console.log("Sending validation request for token:", tokenToValidate);
            const res = await socketClientConnect.requestResponse(
                '/app/validate-reset-token',
                { token: tokenToValidate },
                '/queue/token-validation-scss'
            );
            
            console.log("Validation response:", res);
            
            if (res && res.valid === true) {
                console.log("Token valid, moving to RESET step");
                setStep(Step.RESET);
                setMessage('Please enter your new password');
                setResetToken(tokenToValidate);
            } else {
                console.log("Token invalid, error:", res?.error);
                setStep(Step.REQUEST);
                setError(res?.error || 'This password reset link is invalid or has expired');
                setMessage('');
            }
        } catch (err: any) {
            console.error("Token validation error:", err);
            setStep(Step.REQUEST);
            setError('Failed to validate reset link: ' + err.message);
            setMessage('');
        } finally {
            setIsValidatingToken(false);
        }
    }

    /**
     * Handle Request Reset
     */
    const handleRequestReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if(!email) {
            setError('Email is required');
            setIsLoading(false);
            return;
        }

        try {
            console.log("=== Password Reset Request Debug ===");
            console.log("Email:", email);
            console.log("Sending to destination: /app/request-password-reset");
            
            const res = await socketClientConnect.requestResponse(
                '/app/request-password-reset',
                { email },
                '/queue/password-reset-request-scss'
            ) as unknown as any;
            
            console.log("=== Response Received ===");
            console.log("Full response:", res);
            
            if (res && res.success === true) {
                console.log("Success path triggered");
                setStep(Step.SUCCESS);
                setMessage(res.message || 'Password reset link sent to your email');
                setEmail(''); // Clear email after success
            } else if (res && res.error) {
                console.log("Error path triggered");
                setError(res.error || 'Failed to send reset email');
            } else {
                console.log("Unexpected response structure");
                setStep(Step.SUCCESS);
                setMessage('If an account exists, a reset link has been sent');
            }
        } catch (err: any) {
            console.error('Password reset request error:', err);
            setError('Failed to request password reset: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }

    /**
     * Handle Reset Password
     */
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        
        if(!newPassword) {
            setError('New password is required');
            setIsLoading(false);
            return;
        }
        if(newPassword !== confirmPassword) {
            setError('Passwords do not match');
            setIsLoading(false);
            return;
        }
        if(newPassword.length < 8) {
            setError('Password must be at least 8 characters');
            setIsLoading(false);
            return;
        }

        try {
            console.log("Resetting password with token:", resetToken);
            const res = await socketClientConnect.requestResponse(
                '/app/reset-password',
                { 
                    token: resetToken,
                    newPassword: newPassword 
                },
                '/queue/password-reset-scss'
            ) as unknown as PasswordResetResponse;
            
            console.log("Password reset response:", res);
            
            if (res && res.success) {
                setStep(Step.SUCCESS);
                setMessage(res.message || 'Password reset successfully');
                // Clear passwords
                setNewPassword('');
                setConfirmPassword('');
            } else {
                setError(res?.error || 'Failed to reset password');
            }
        } catch (err: any) {
            console.error('Password reset error:', err);
            setError('Failed to reset password: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }

    // Show loading state while validating token
    if (isValidatingToken) {
        return (
            <div className="password-reset-container">
                <div className="validating-message">
                    <h2>Validating your reset link...</h2>
                    <p>Please wait while we verify your password reset link.</p>
                </div>
            </div>
        );
    }

    return (
        <PasswordReset
            apiClientController={apiClientController}
            socketClientConnect={socketClientConnect}
            onBackToLogin={onBackToLogin}
            token={token}
            passwordReset={passwordReset}
            handleRequestReset={handleRequestReset}
            handleResetPassword={handleResetPassword}
            validateToken={validateToken}
        />
    );
}