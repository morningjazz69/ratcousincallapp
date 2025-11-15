# 🚀 Railway Deployment Guide

## Step 1: Prepare Your Code

1. **Initialize Git Repository**:
```bash
git init
git add .
git commit -m "Initial voice call app with security"
```

2. **Push to GitHub**:
```bash
# Create a new repository on GitHub first, then:
git remote add origin https://github.com/yourusername/voice-call-app.git
git branch -M main
git push -u origin main
```

## Step 2: Deploy to Railway

1. **Go to Railway.app**:
   - Visit [railway.app](https://railway.app)
   - Sign up with your GitHub account

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your voice-call-app repository

3. **Set Environment Variables**:
   In the Railway dashboard, go to Variables and add:
   ```
   CALL_PASSWORD=your-call-password-here
   ADMIN_PASSWORD=BumbleBiscuit$55
   PORT=3000
   NODE_ENV=production
   ```

4. **Deploy**:
   - Railway will automatically build and deploy
   - You'll get a URL like `https://your-app-name.railway.app`

## Step 3: Configure Your Passwords

### For Viewers (Call Password):
- Set `CALL_PASSWORD` to something simple like "voice2024" or "stream"
- Share this with your viewers

### For Admin (Your Code):
- `ADMIN_PASSWORD` is already set to "BumbleBiscuit$55"
- Keep this secret - only you need it for admin controls

## Step 4: Test Your Deployment

1. **Share the Railway URL** with a test user
2. **Have them join** with the call password
3. **Join as admin** with your admin code
4. **Test the 16-channel routing** with your Loopback setup

## 🔒 Security Features

✅ **Call Password Protection**: Prevents random people from joining  
✅ **Admin Code Protection**: Only you can access channel controls  
✅ **Environment Variables**: Passwords stored securely on Railway  
✅ **HTTPS Automatic**: Railway provides SSL certificates  

## 🎯 Usage for Streams

1. **Share with viewers**: "Join at [your-railway-url] with password: [call-password]"
2. **You join as admin**: Use your secret admin code for channel controls
3. **Professional setup**: Each caller goes to separate Loopback channels

Your app will be live at: `https://yourapp.railway.app`