<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Program Notice</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
        }
        .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px 10px 0 0;
            margin: -30px -30px 20px -30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            margin: 20px 0;
        }
        .message-box {
            background-color: #f8f9fa;
            border-left: 4px solid #667eea;
            padding: 15px;
            margin: 20px 0;
            border-radius: 5px;
        }
        .image-container {
            margin: 20px 0;
            text-align: center;
        }
        .image-container img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📢 Program Notice</h1>
        </div>
        
        <div class="content">
            <p>Dear <strong>{{ $beneficiaryName }}</strong>,</p>
            
            <p>You have received a notice regarding the program: <strong>{{ $programName }}</strong></p>
            
            <div class="message-box">
                <p style="white-space: pre-wrap;">{{ $message }}</p>
            </div>
            
            @if($imagePath)
            <div class="image-container">
                <img src="{{ $imagePath }}" alt="Notice Image" />
            </div>
            @endif
            
            <p style="margin-top: 20px;">
                Please check your notifications in the system for more details.
            </p>
            
            @if($programId)
            <div style="text-align: center; margin-top: 30px;">
                <a href="{{ url('/residents/myBenefits?program=' . $programId) }}" class="button">
                    View Program Details
                </a>
            </div>
            @endif
        </div>
        
        <div class="footer">
            <p>This is an automated message from the Barangay Management System.</p>
            <p>Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>

