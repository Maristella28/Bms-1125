<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Blotter Request Approved - Barangay e-Governance</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            color: #1f2937;
            margin: 0;
            padding: 20px;
            background: #f5f7fa;
            background-attachment: fixed;
        }
        .email-wrapper {
            max-width: 680px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04);
        }
        .header {
            background: linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%);
            color: white;
            padding: 48px 40px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
            pointer-events: none;
        }
        .header-content {
            position: relative;
            z-index: 2;
        }
        .logo-container {
            margin-bottom: 24px;
        }
        .logo {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            border: 4px solid rgba(255, 255, 255, 0.3);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            background: white;
            padding: 4px;
            display: block;
            margin: 0 auto;
            object-fit: cover;
        }
        .header h1 {
            margin: 0 0 10px 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.3px;
        }
        .header-subtitle {
            margin: 0;
            font-size: 15px;
            opacity: 0.92;
            font-weight: 400;
            letter-spacing: 0.2px;
        }
        .content {
            padding: 48px 40px;
            background: #ffffff;
        }
        .greeting {
            font-size: 18px;
            margin-bottom: 28px;
            color: #111827;
            font-weight: 600;
            line-height: 1.6;
        }
        .greeting strong {
            color: #059669;
            font-weight: 700;
            position: relative;
        }
        .success-banner {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 1px solid #10b981;
            border-left: 5px solid #10b981;
            padding: 24px 28px;
            border-radius: 14px;
            margin: 28px 0;
            display: flex;
            align-items: flex-start;
            gap: 18px;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
            position: relative;
            overflow: hidden;
        }
        .success-banner::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 100px;
            height: 100px;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
            pointer-events: none;
        }
        .success-icon {
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: white;
            font-weight: 700;
            font-size: 28px;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35), 0 0 0 3px rgba(16, 185, 129, 0.1);
            line-height: 1;
            position: relative;
            border: 2px solid rgba(255, 255, 255, 0.2);
        }
        .success-icon::before {
            content: '';
            position: absolute;
            inset: -2px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), transparent);
            opacity: 0.5;
        }
        .success-banner-content {
            flex: 1;
        }
        .success-banner p {
            margin: 0;
            color: #065f46;
            font-size: 16px;
            font-weight: 600;
            line-height: 1.6;
        }
        .info-card {
            background: linear-gradient(135deg, #ffffff 0%, #f9fafb 100%);
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            padding: 32px;
            margin: 28px 0;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.02);
            position: relative;
            overflow: hidden;
        }
        .info-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #059669 0%, #10b981 100%);
        }
        .info-card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 20px;
            padding-bottom: 16px;
            border-bottom: 2px solid #e5e7eb;
        }
        .info-card-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 700;
            font-size: 24px;
            flex-shrink: 0;
            font-style: normal;
            line-height: 1;
            box-shadow: 0 3px 10px rgba(5, 150, 105, 0.25), 0 0 0 2px rgba(5, 150, 105, 0.1);
            position: relative;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .info-card-icon::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
            pointer-events: none;
        }
        .info-card h3 {
            margin: 0;
            color: #111827;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.2px;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px solid #e5e7eb;
            transition: background-color 0.2s ease;
        }
        .info-row:hover {
            background-color: rgba(5, 150, 105, 0.02);
            margin: 0 -8px;
            padding-left: 8px;
            padding-right: 8px;
            border-radius: 8px;
        }
        .info-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }
        .info-label {
            color: #6b7280;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .info-label::before {
            content: '▸';
            color: #059669;
            font-size: 12px;
            font-weight: 700;
        }
        .info-value {
            color: #059669;
            font-weight: 700;
            font-size: 15px;
            text-align: right;
        }
        .ticket-section {
            background: linear-gradient(135deg, #047857 0%, #059669 50%, #10b981 100%);
            color: white;
            padding: 40px 36px;
            border-radius: 16px;
            text-align: center;
            margin: 32px 0;
            box-shadow: 0 6px 20px rgba(5, 150, 105, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
            position: relative;
            overflow: hidden;
        }
        .ticket-section::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.15) 0%, transparent 70%);
            pointer-events: none;
        }
        .ticket-label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            opacity: 0.95;
            margin-bottom: 14px;
            font-weight: 600;
        }
        .ticket-value {
            font-size: 36px;
            font-weight: 800;
            letter-spacing: 4px;
            font-family: 'Courier New', 'Monaco', monospace;
            background: rgba(255, 255, 255, 0.2);
            padding: 20px 36px;
            border-radius: 12px;
            display: inline-block;
            border: 2px solid rgba(255, 255, 255, 0.3);
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.3);
            position: relative;
            z-index: 1;
            backdrop-filter: blur(10px);
        }
        .warning-box {
            background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
            border: 1px solid #fcd34d;
            border-left: 5px solid #f59e0b;
            padding: 24px 28px;
            border-radius: 14px;
            margin: 28px 0;
            box-shadow: 0 2px 8px rgba(245, 158, 11, 0.1);
            position: relative;
            overflow: hidden;
        }
        .warning-box::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 100px;
            height: 100px;
            background: radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%);
            pointer-events: none;
        }
        .warning-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 10px;
        }
        .warning-icon {
            width: 48px;
            height: 48px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: white;
            font-weight: 700;
            font-size: 24px;
            line-height: 1;
            box-shadow: 0 3px 10px rgba(245, 158, 11, 0.3), 0 0 0 2px rgba(245, 158, 11, 0.1);
            position: relative;
            border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .warning-icon::before {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: 12px;
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), transparent);
            pointer-events: none;
        }
        .warning-box strong {
            display: block;
            color: #92400e;
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 6px;
        }
        .warning-box p {
            margin: 0;
            color: #78350f;
            font-size: 14px;
            line-height: 1.7;
            font-weight: 500;
        }
        .divider {
            height: 1px;
            background: linear-gradient(90deg, transparent, #e5e7eb 20%, #e5e7eb 80%, transparent);
            margin: 36px 0;
            border: none;
            position: relative;
        }
        .divider::before {
            content: '✦';
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 0 12px;
            color: #9ca3af;
            font-size: 12px;
        }
        .description-text {
            color: #4b5563;
            font-size: 15px;
            line-height: 1.8;
            margin: 28px 0;
            text-align: center;
            padding: 0 10px;
        }
        .btn-container {
            text-align: center;
            margin: 36px 0;
        }
        .btn {
            display: inline-block;
            padding: 16px 36px;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            color: white !important;
            text-decoration: none;
            border-radius: 10px;
            font-weight: 700;
            font-size: 15px;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 12px rgba(5, 150, 105, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.1);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            transition: left 0.5s;
        }
        .btn:hover::before {
            left: 100%;
        }
        .contact-info {
            background: linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%);
            border: 1px solid #e5e7eb;
            border-radius: 14px;
            padding: 36px 28px 28px;
            margin: 32px 0;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            position: relative;
        }
        .contact-icon {
            position: absolute;
            top: -16px;
            left: 50%;
            transform: translateX(-50%);
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            box-shadow: 0 3px 10px rgba(5, 150, 105, 0.25);
            border: 3px solid white;
        }
        .contact-info p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
            line-height: 1.7;
        }
        .contact-info strong {
            color: #374151;
            font-weight: 700;
        }
        .signature {
            margin-top: 32px;
            padding-top: 28px;
            border-top: 1px solid #e5e7eb;
        }
        .signature p {
            margin: 6px 0;
            color: #374151;
            font-size: 14px;
            line-height: 1.8;
        }
        .signature strong {
            color: #059669;
            font-weight: 700;
            font-size: 15px;
        }
        .footer {
            background: #1f2937;
            color: #d1d5db;
            padding: 36px 30px;
            text-align: center;
            border-top: 3px solid #059669;
        }
        .footer-logo-text {
            font-size: 18px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 14px;
            letter-spacing: 0.3px;
        }
        .footer p {
            margin: 8px 0;
            color: #9ca3af;
            font-size: 13px;
            line-height: 1.7;
        }
        .footer strong {
            color: #ffffff;
            font-weight: 700;
        }
        .footer-divider {
            height: 1px;
            background: #374151;
            margin: 22px 0;
        }
        .footer-copyright {
            margin-top: 18px;
            padding-top: 18px;
            border-top: 1px solid #374151;
            color: #6b7280;
            font-size: 12px;
        }
        /* Tablet and below */
        @media only screen and (max-width: 768px) {
            .email-wrapper {
                max-width: 100%;
                margin: 0;
                border-radius: 0;
            }
            .header {
                padding: 40px 32px 36px;
            }
            .content {
                padding: 40px 32px;
            }
        }
        
        /* Mobile landscape and below */
        @media only screen and (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-wrapper {
                border-radius: 12px;
            }
            .header {
                padding: 36px 24px 32px;
            }
            .header h1 {
                font-size: 24px;
            }
            .header-subtitle {
                font-size: 14px;
            }
            .content {
                padding: 32px 24px;
            }
            .info-card {
                padding: 24px;
            }
            .info-row {
                flex-direction: column;
                align-items: flex-start;
                gap: 6px;
                padding: 12px 0;
            }
            .info-value {
                text-align: left;
                font-size: 14px;
            }
            .ticket-value {
                font-size: 26px;
                padding: 14px 24px;
            }
            .btn {
                padding: 14px 28px;
                font-size: 14px;
                width: 100%;
                max-width: 100%;
                box-sizing: border-box;
            }
            .logo {
                width: 70px;
                height: 70px;
            }
        }
        
        /* Small mobile devices */
        @media only screen and (max-width: 480px) {
            body {
                padding: 5px;
            }
            .email-wrapper {
                border-radius: 8px;
            }
            .header {
                padding: 28px 20px 24px;
            }
            .header h1 {
                font-size: 22px;
            }
            .header-subtitle {
                font-size: 13px;
            }
            .content {
                padding: 24px 20px;
            }
            .info-card {
                padding: 20px;
            }
            .ticket-value {
                font-size: 22px;
                padding: 12px 20px;
            }
            .btn {
                padding: 12px 24px;
                font-size: 13px;
            }
            .logo {
                width: 60px;
                height: 60px;
            }
            .greeting {
                font-size: 16px;
                margin-bottom: 20px;
            }
        }
        
        /* Very small mobile devices */
        @media only screen and (max-width: 320px) {
            body {
                padding: 0;
            }
            .email-wrapper {
                border-radius: 0;
            }
            .header {
                padding: 24px 16px 20px;
            }
            .header h1 {
                font-size: 20px;
            }
            .content {
                padding: 20px 16px;
            }
            .info-card {
                padding: 16px;
            }
            .ticket-value {
                font-size: 20px;
                padding: 10px 16px;
            }
            .btn {
                padding: 10px 20px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <!-- Enhanced Header -->
        <div class="header">
            <div class="header-content">
                <div class="logo-container">
                    @php
                        $logoEmbedded = null;
                        $logoDataUri = null;
                        $appUrl = rtrim(config('app.url', 'http://localhost:8000'), '/');
                        
                        if (isset($message) && method_exists($message, 'embed')) {
                            $logoPaths = [
                                public_path('assets/logo.jpg'),
                                public_path('assets/images/logo.jpg'),
                            ];
                            
                            foreach ($logoPaths as $path) {
                                if (file_exists($path) && is_readable($path)) {
                                    try {
                                        $logoEmbedded = $message->embed($path);
                                        break;
                                    } catch (\Exception $e) {}
                                }
                            }
                        }
                        
                        if (!$logoEmbedded) {
                            $logoPaths = [
                                isset($logoPath) && $logoPath ? $logoPath : null,
                                public_path('assets/logo.jpg'),
                                public_path('assets/images/logo.jpg'),
                            ];
                            
                            foreach ($logoPaths as $path) {
                                if ($path && file_exists($path) && is_readable($path)) {
                                    try {
                                        $logoContent = file_get_contents($path);
                                        if ($logoContent && strlen($logoContent) > 100) {
                                            $logoBase64 = base64_encode($logoContent);
                                            $logoDataUri = 'data:image/jpeg;base64,' . $logoBase64;
                                            break;
                                        }
                                    } catch (\Exception $e) {}
                                }
                            }
                        }
                        
                        $logoUrl = null;
                        if (!$logoEmbedded && !$logoDataUri) {
                            $logoPaths = [
                                'assets/logo.jpg' => public_path('assets/logo.jpg'),
                                'assets/images/logo.jpg' => public_path('assets/images/logo.jpg'),
                            ];
                            
                            foreach ($logoPaths as $webPath => $filePath) {
                                if (file_exists($filePath)) {
                                    $logoUrl = $appUrl . '/' . $webPath;
                                    break;
                                }
                            }
                        }
                    @endphp
                    @if($logoEmbedded)
                        <img src="{{ $logoEmbedded }}" alt="Barangay Mamatid Logo" class="logo" width="90" height="90" border="0" style="width: 90px; height: 90px;">
                    @elseif($logoDataUri && strlen($logoDataUri) > 100)
                        <img src="{{ $logoDataUri }}" alt="Barangay Mamatid Logo" class="logo" width="90" height="90" border="0" style="width: 90px; height: 90px;">
                    @elseif($logoUrl)
                        <img src="{{ $logoUrl }}" alt="Barangay Mamatid Logo" class="logo" width="90" height="90" border="0" style="width: 90px; height: 90px;">
                    @else
                        <div style="width: 90px; height: 90px; border-radius: 50%; background: white; display: inline-block; text-align: center; line-height: 90px; border: 4px solid rgba(255,255,255,0.3); font-size: 28px; font-weight: 700; color: #059669; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);">BM</div>
                    @endif
                </div>
                <h1>Request Approved</h1>
                <p class="header-subtitle">Your Blotter Request Has Been Successfully Processed</p>
            </div>
        </div>
        
        <!-- Main Content -->
        <div class="content">
            <!-- Personalized Greeting -->
            <div class="greeting">
                Hello <strong>{{ $user->name ?? 'Resident' }}</strong>,
            </div>
            
            <!-- Success Banner -->
            <div class="success-banner">
                <div class="success-icon" style="position: relative; z-index: 1;">✓</div>
                <div class="success-banner-content">
                    <p>Congratulations! Your blotter request has been reviewed and approved by our administration team.</p>
                </div>
            </div>
            
            <!-- Request Information Card -->
            <div class="info-card">
                <div class="info-card-header">
                    <div class="info-card-icon" style="position: relative; z-index: 1;">ℹ</div>
                    <h3>Request Details</h3>
                </div>
                <div class="info-row">
                    <span class="info-label">Request ID</span>
                    <span class="info-value">#{{ $blotterRequest->id }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Approval Scheduled Date</span>
                    <span class="info-value">{{ $approvedDate }}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Approval Scheduled Time</span>
                    <span class="info-value">{{ $approvedTime }}</span>
                </div>
            </div>
            
            <!-- Ticket Number Section -->
            <div class="ticket-section">
                <div style="position: relative; z-index: 1;">
                    <div class="ticket-label">Your Official Ticket Number</div>
                    <div class="ticket-value">{{ $blotterRequest->ticket_number ?? 'N/A' }}</div>
                </div>
            </div>
            
            <!-- Important Reminder -->
            <div class="warning-box">
                <div class="warning-header">
                    <div class="warning-icon" style="position: relative; z-index: 1;">⚠</div>
                    <strong>Important Reminder</strong>
                </div>
                <p>Please keep your ticket number safe and secure. You will need this number when following up on your blotter request, contacting the barangay office, or for any future reference regarding this matter.</p>
            </div>
            
            <!-- Divider -->
            <div class="divider"></div>
            
            <!-- Description -->
            <p class="description-text">
                Your blotter request has been carefully reviewed and approved by the barangay administration. 
                You can now track the status, view complete details, and manage your request through your account dashboard.
            </p>
            
            <!-- Call to Action Button -->
            <div class="btn-container">
                <a href="{{ $actionUrl }}" class="btn">View My Blotter Requests</a>
            </div>
            
            <!-- Contact Information -->
            <div class="contact-info">
                <div class="contact-icon">💬</div>
                <p>
                    <strong>Need Assistance?</strong><br>
                    If you have any questions or need further assistance, please don't hesitate to contact the barangay office. 
                    Our team is here to help you.
                </p>
            </div>
            
            <!-- Signature -->
            <div class="signature">
                <p>Best regards,</p>
                <p><strong>Barangay Administration Team</strong></p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 12px;">Barangay e-Governance System</p>
            </div>
        </div>
        
        <!-- Enhanced Footer -->
        <div class="footer">
            <div class="footer-logo-text">Barangay e-Governance</div>
            <p><strong>Automated Notification System</strong></p>
            <p>This is an automated email notification. Please do not reply to this message.</p>
            <div class="footer-divider"></div>
            <p>For inquiries or support, please visit your barangay office or contact us through the system.</p>
            <div class="footer-copyright">
                © {{ date('Y') }} Barangay e-Governance System. All rights reserved.
            </div>
        </div>
    </div>
</body>
</html>
