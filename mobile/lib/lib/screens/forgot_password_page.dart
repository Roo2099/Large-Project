import 'package:flutter/material.dart';

import '../services/api_service.dart';
import '../theme/app_theme.dart';

class ForgotPasswordPage extends StatefulWidget {
  const ForgotPasswordPage({super.key});

  @override
  State<ForgotPasswordPage> createState() => _ForgotPasswordPageState();
}

class _ForgotPasswordPageState extends State<ForgotPasswordPage> {
  final TextEditingController emailController = TextEditingController();

  bool isSubmitting = false;
  String feedbackMessage = '';
  bool isError = false;

  Future<void> _submitResetRequest() async {
    FocusScope.of(context).unfocus();
    final String email = emailController.text.trim();

    if (email.isEmpty) {
      setState(() {
        feedbackMessage =
            'Please enter the email associated with your account.';
        isError = true;
      });
      return;
    }

    setState(() {
      isSubmitting = true;
      feedbackMessage = '';
      isError = false;
    });

    try {
      final Map<String, dynamic> result = await ApiService.requestPasswordReset(
        email,
      );

      if (!mounted) {
        return;
      }

      final String? error = result['error']?.toString();
      if (error != null && error.isNotEmpty) {
        final String normalizedError = error.toLowerCase();
        final bool hideDetails =
            normalizedError.contains('no user') ||
            normalizedError.contains('not found');
        setState(() {
          feedbackMessage = hideDetails
              ? "If that account exists, we'll email a reset link shortly."
              : error;
          isError = !hideDetails;
          isSubmitting = false;
        });
        return;
      }

      final String successMessage =
          result['message']?.toString() ??
          "If that account exists, we'll email a reset link shortly.";

      setState(() {
        feedbackMessage = successMessage;
        isError = false;
        isSubmitting = false;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        feedbackMessage = 'Unable to send reset link: $error';
        isError = true;
        isSubmitting = false;
      });
    }
  }

  @override
  void dispose() {
    emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final ThemeData theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colorScheme.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: AppColors.border),
                boxShadow: <BoxShadow>[
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 24,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    Center(
                      child: Container(
                        height: 56,
                        width: 56,
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(18),
                        ),
                        child: const Icon(
                          Icons.lock_reset,
                          color: AppColors.primary,
                          size: 30,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Reset your password',
                      textAlign: TextAlign.center,
                      style: theme.textTheme.headlineSmall?.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Enter your account email. If it exists, you'll receive a link to reset your password.",
                      textAlign: TextAlign.center,
                      style: theme.textTheme.bodyMedium?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 24),
                    TextField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'Email',
                        prefixIcon: Icon(Icons.alternate_email),
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton(
                        onPressed: isSubmitting ? null : _submitResetRequest,
                        child: Text(
                          isSubmitting ? 'Sending...' : 'Send reset link',
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Back to sign in'),
                    ),
                    if (feedbackMessage.isNotEmpty) ...<Widget>[
                      const SizedBox(height: 12),
                      Text(
                        feedbackMessage,
                        textAlign: TextAlign.center,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: isError
                              ? theme.colorScheme.error
                              : AppColors.accentGreen,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
