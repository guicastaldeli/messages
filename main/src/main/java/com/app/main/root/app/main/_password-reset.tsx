import React, { useState, useEffect } from 'react';
import { ApiClientController } from './_api-client/api-client-controller';
import { SocketClientConnect } from './socket-client-connect';

export interface PasswordResetProps {
    apiClientController: ApiClientController;
    socketClientConnect: SocketClientConnect;
    onBackToLogin: () => void;
    token?: string;
    passwordReset?: {
        email: string;
        newPassword: string;
        confirmPassword: string;
        resetToken: string;
        isLoading: boolean;
        message: string;
        error: string;
        step: Step;
        setEmail: (email: string) => void;
        setNewPassword: (password: string) => void;
        setConfirmPassword: (password: string) => void;
        setResetToken: (token: string) => void;
        setIsLoading: (loading: boolean) => void;
        setMessage: (msg: string) => void;
        setError: (err: string) => void;
        setStep: (step: Step) => void;
    };
    handleRequestReset?: (e: React.FormEvent) => void;
    handleResetPassword?: (e: React.FormEvent) => void;
    validateToken?: (token: string) => void;
}

export enum Step {
    REQUEST = 'request',
    VALIDATE = 'validate',
    RESET = 'reset',
    SUCCESS = 'success'
}

export const PasswordReset: React.FC<PasswordResetProps> = ({
    apiClientController,
    socketClientConnect,
    onBackToLogin,
    token,
    passwordReset,
    handleRequestReset,
    handleResetPassword,
    validateToken
}) => {
    const [localStep, setLocalStep] = useState<Step>(token ? Step.VALIDATE : Step.REQUEST);
    const [localEmail, setLocalEmail] = useState('');
    const [localNewPassword, setLocalNewPassword] = useState('');
    const [localConfirmPassword, setLocalConfirmPassword] = useState('');
    const [localResetToken, setLocalResetToken] = useState(token || '');
    const [localIsLoading, setLocalIsLoading] = useState(false);
    const [localMessage, setLocalMessage] = useState('');
    const [localError, setLocalError] = useState('');

    const step = passwordReset?.step ?? localStep;
    const email = passwordReset?.email ?? localEmail;
    const newPassword = passwordReset?.newPassword ?? localNewPassword;
    const confirmPassword = passwordReset?.confirmPassword ?? localConfirmPassword;
    const resetToken = passwordReset?.resetToken ?? localResetToken;
    const isLoading = passwordReset?.isLoading ?? localIsLoading;
    const message = passwordReset?.message ?? localMessage;
    const error = passwordReset?.error ?? localError;
    
    const setEmail = (value: string) => {
        if (passwordReset?.setEmail) {
            passwordReset.setEmail(value);
        } else {
            setLocalEmail(value);
        }
    };

    const setNewPassword = (value: string) => {
        if (passwordReset?.setNewPassword) {
            passwordReset.setNewPassword(value);
        } else {
            setLocalNewPassword(value);
        }
    };

    const setConfirmPassword = (value: string) => {
        if (passwordReset?.setConfirmPassword) {
            passwordReset.setConfirmPassword(value);
        } else {
            setLocalConfirmPassword(value);
        }
    };

    const setSession = (session: string): void => {
        console.log(`Setting session to: ${session}`);
    }

    useEffect(() => {
        console.log("PasswordReset component mounted");
        setSession('PASSWORD_RESET');
        
        if(token) {
            console.log("Setting local reset token:", token);
            setLocalResetToken(token);
        }
    }, [token]);

    /**
     * Render Request Step
     */
    const renderRequestStep = () => (
        <div className="password-reset-form">
            <h2>Reset Your Password</h2>
            <p>Enter your email address and we'll send you a link to reset your password.</p>
            
            <form onSubmit={handleRequestReset}>
                <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                    />
                </div>
                
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            
            <button type="button" onClick={onBackToLogin} className="back-link">
                Back to Login
            </button>
        </div>
    );

    /**
     * Render Reset Step
     */
    const renderResetStep = () => (
        <div className="password-reset-form">
            <h2>Create New Password</h2>
            <p>Please enter your new password below.</p>
            
            <form onSubmit={(e) => {
                e.preventDefault();
                handleResetPassword?.(e);
            }}>
                <div className="form-group">
                    <label htmlFor="newPassword">New Password</label>
                    <input
                        type="password"
                        id="newPassword"
                        value={newPassword}
                        onChange={(e) => {
                            e.preventDefault();
                            setNewPassword(e.target.value);
                        }}
                        placeholder="Enter new password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <input
                        type="password"
                        id="confirmPassword"
                        value={confirmPassword}
                        onChange={(e) => {
                            e.preventDefault();
                            setConfirmPassword(e.target.value);
                        }}
                        placeholder="Confirm new password"
                        required
                        minLength={8}
                        autoComplete="new-password"
                    />
                </div>
                
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
        </div>
    );

    /**
     * Render Success Step
     */
    const renderSuccessStep = () => (
        <div className="password-reset-success">
            <h2>Password Reset Successful!</h2>
            <p>{message}</p>
            <button type="button" onClick={onBackToLogin}>
                Back to Login
            </button>
        </div>
    );

    return (
        <div className="password-reset-container">
            {message && <div className="message">{message}</div>}
            {error && <div className="error">{error}</div>}
            
            {step === Step.REQUEST && renderRequestStep()}
            {step === Step.RESET && renderResetStep()}
            {step === Step.SUCCESS && renderSuccessStep()}
        </div>
    );
}