import React from 'react';
import { WebView } from 'react-native-webview';

const FirebaseValidation = () => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>XSCard Login Success</title>
        <style>
            :root {
                --primary: #FF4B6E;
                --secondary: #1B2B5B;
                --white: #FFFFFF;
                --black: #000000;
                --gray: #666666;
            }

            body {
                font-family: 'Arial', sans-serif;
                margin: 0;
                padding: 0;
                background-color: var(--secondary);
                color: var(--black);
                line-height: 1.6;
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .container {
                background-color: var(--white);
                max-width: 1200px;
                margin: 40px auto;
                padding: 40px;
                border-radius: 20px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                text-align: center;
            }

            .logo {
                max-width: 150px;
                margin-bottom: 20px;
            }

            h1 {
                color: var(--secondary);
                font-size: 2.5em;
                margin-bottom: 20px;
            }

            .success-message {
                color: var(--primary);
                font-size: 1.8em;
                margin: 30px 0;
            }

            .highlight {
                background-color: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                margin: 20px 0;
            }

            @media screen and (max-width: 768px) {
                .container {
                    margin: 20px;
                    padding: 20px;
                }

                h1 {
                    font-size: 2em;
                }
            }

            @media screen and (max-width: 480px) {
                .container {
                    margin: 10px;
                    padding: 15px;
                }

                h1 {
                    font-size: 1.8em;
                }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <img src="assets/images/xs-logo.png" alt="XSCard Logo" class="logo">
            <div class="highlight">
                <h1 class="success-message">Welcome to XSCard!</h1>
                <p>You have successfully logged in to your account.</p>
            </div>
        </div>
    </body>
    </html>
  `;

  return (
    <WebView
      source={{ html: htmlContent }}
      style={{ flex: 1 }}
      scalesPageToFit={true}
      startInLoadingState={true}
      javaScriptEnabled={true}
    />
  );
};

export default FirebaseValidation;