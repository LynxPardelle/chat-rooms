# Manual Testing Guide - Chat Rooms Frontend

## Overview

This document provides comprehensive manual testing procedures for the Chat Rooms application frontend. Follow these steps to ensure all functionality works correctly before deployment.

## Table of Contents

1. [Environment Setup](#environment-setup)
2. [Authentication Testing](#authentication-testing)
3. [Chat Functionality Testing](#chat-functionality-testing)
4. [Profile Management Testing](#profile-management-testing)
5. [UI/UX Testing](#uiux-testing)
6. [Responsive Design Testing](#responsive-design-testing)
7. [Performance Testing](#performance-testing)
8. [Accessibility Testing](#accessibility-testing)
9. [Browser Compatibility Testing](#browser-compatibility-testing)
10. [Error Handling Testing](#error-handling-testing)

## Environment Setup

### Prerequisites
- [ ] Backend server is running on `http://localhost:3001`
- [ ] MongoDB is running and accessible
- [ ] Frontend development server is running on `http://localhost:5173`
- [ ] Browser developer tools are open for debugging

### Initial Checks
1. [ ] Navigate to `http://localhost:5173`
2. [ ] Verify the page loads without console errors
3. [ ] Check that the application displays the login/register form
4. [ ] Verify all static assets (CSS, images) load correctly

## Authentication Testing

### User Registration

#### Test Case: Valid Registration
**Objective:** Verify users can successfully register with valid data

**Steps:**
1. [ ] Navigate to the login page (`/auth/login`)
2. [ ] Click "Create one here" link or navigate directly to registration page (`/auth/register`)
3. [ ] Fill in the form with valid data:
   - Username: `testuser123`
   - Email: `test@example.com`
   - Password: `TestPassword123!`
   - Confirm Password: `TestPassword123!`
   - Text Color: Choose any color
   - Background Color: Choose any color
   - Accept Terms: Check the checkbox
4. [ ] Click "Create Account" button
5. [ ] Verify success message appears
6. [ ] Verify user is redirected to login page after 2 seconds
7. [ ] Check for success message/notification

**Expected Result:** User successfully registers and is redirected to login

#### Test Case: Navigation Between Login and Register
**Objective:** Verify users can easily navigate between login and register forms

**Steps:**
1. [ ] Navigate to login page (`/auth/login`)
2. [ ] Verify "Create one here" link is visible
3. [ ] Click "Create one here" link
4. [ ] Verify redirect to registration page (`/auth/register`)
5. [ ] Verify "Sign in here" link is visible
6. [ ] Click "Sign in here" link
7. [ ] Verify redirect back to login page

**Expected Result:** Navigation works smoothly between login and register forms

#### Test Case: Invalid Registration Data
**Objective:** Verify validation works for invalid data

**Steps:**
1. [ ] Navigate to registration page
2. [ ] Test each validation scenario:

**Invalid Email:**
- [ ] Enter email: `invalid-email`
- [ ] Verify error message: "Please enter a valid email address"

**Weak Password:**
- [ ] Enter password: `123`
- [ ] Verify error message about password requirements
- [ ] Check password strength indicator shows "weak"

**Password Mismatch:**
- [ ] Enter password: `TestPassword123!`
- [ ] Enter confirm password: `DifferentPassword123!`
- [ ] Verify error message: "Passwords do not match"

**Missing Required Fields:**
- [ ] Leave username field empty
- [ ] Try to submit form
- [ ] Verify error message: "Username is required"

**Duplicate Email:**
- [ ] Use email from previous registration
- [ ] Verify error message: "Email already exists"

**Expected Result:** All validation errors display correctly

#### Test Case: Password Strength Indicator
**Objective:** Verify password strength indicator works correctly

**Steps:**
1. [ ] Focus on password field
2. [ ] Test different password strengths:
   - Weak: `123` → Should show red indicator
   - Medium: `TestPass123` → Should show yellow indicator  
   - Strong: `TestPassword123!@#` → Should show green indicator
3. [ ] Verify password requirements checklist updates in real-time

**Expected Result:** Password strength indicator updates correctly

### User Login

#### Test Case: Valid Login
**Objective:** Verify users can login with valid credentials

**Steps:**
1. [ ] Navigate to login page (`/auth/login`)
2. [ ] Enter valid credentials:
   - Email: `test@example.com`
   - Password: `TestPassword123!`
3. [ ] Click "Login" button
4. [ ] Verify redirect to chat page
5. [ ] Check that user menu shows logged-in user

**Expected Result:** User successfully logs in and is redirected

#### Test Case: Invalid Login
**Objective:** Verify error handling for invalid credentials

**Steps:**
1. [ ] Navigate to login page
2. [ ] Enter invalid credentials:
   - Email: `wrong@email.com`
   - Password: `wrongpassword`
3. [ ] Click "Login" button
4. [ ] Verify error message: "Invalid credentials"

**Expected Result:** Error message displays correctly

#### Test Case: Empty Fields
**Objective:** Verify validation for empty login fields

**Steps:**
1. [ ] Navigate to login page
2. [ ] Leave email field empty
3. [ ] Try to submit form
4. [ ] Verify error message: "Email is required"
5. [ ] Repeat for password field

**Expected Result:** Required field validation works

#### Test Case: Remember Me Functionality
**Objective:** Verify remember me checkbox works

**Steps:**
1. [ ] Login with "Remember Me" checked
2. [ ] Close browser tab
3. [ ] Reopen application
4. [ ] Verify user is still logged in

**Expected Result:** User remains logged in after browser restart

### Session Management

#### Test Case: Session Persistence
**Objective:** Verify session persists across page reloads

**Steps:**
1. [ ] Login successfully
2. [ ] Reload the page
3. [ ] Verify user remains logged in
4. [ ] Check that chat interface is accessible

**Expected Result:** Session persists after page reload

#### Test Case: Logout Functionality
**Objective:** Verify logout works correctly

**Steps:**
1. [ ] Login successfully
2. [ ] Click user menu
3. [ ] Click "Logout" button
4. [ ] Verify redirect to login page
5. [ ] Try to access protected page directly
6. [ ] Verify redirect back to login

**Expected Result:** User is logged out and cannot access protected pages

#### Test Case: Token Expiration
**Objective:** Verify handling of expired tokens

**Steps:**
1. [ ] Login successfully
2. [ ] Wait for token to expire (or manually expire in dev tools)
3. [ ] Try to perform an action requiring authentication
4. [ ] Verify user is redirected to login page

**Expected Result:** Expired tokens are handled gracefully

## Chat Functionality Testing

### Basic Chat Operations

#### Test Case: Send Message
**Objective:** Verify users can send messages

**Steps:**
1. [ ] Login and navigate to chat
2. [ ] Type message in input field: "Hello, this is a test message"
3. [ ] Press Enter or click Send button
4. [ ] Verify message appears in chat history
5. [ ] Check message shows correct timestamp
6. [ ] Verify message shows correct sender name

**Expected Result:** Message is sent and displayed correctly

#### Test Case: Receive Message
**Objective:** Verify users can receive messages from others

**Steps:**
1. [ ] Open application in two different browser tabs/windows
2. [ ] Login as different users in each tab
3. [ ] Send message from first user
4. [ ] Verify message appears in second user's chat
5. [ ] Check real-time delivery

**Expected Result:** Messages are received in real-time

#### Test Case: Message History
**Objective:** Verify chat history is loaded and displayed

**Steps:**
1. [ ] Send several messages
2. [ ] Reload the page
3. [ ] Verify previous messages are still visible
4. [ ] Check message order is correct (newest at bottom)
5. [ ] Verify pagination works if many messages

**Expected Result:** Message history is preserved and displayed correctly

#### Test Case: Empty Message Handling
**Objective:** Verify empty messages cannot be sent

**Steps:**
1. [ ] Try to send empty message (just spaces)
2. [ ] Verify message is not sent
3. [ ] Check no empty message appears in chat

**Expected Result:** Empty messages are rejected

#### Test Case: Long Message Handling
**Objective:** Verify handling of very long messages

**Steps:**
1. [ ] Create a message with 1000+ characters
2. [ ] Try to send the message
3. [ ] Verify message is either:
   - Truncated with indicator
   - Rejected with error message
   - Displayed with proper text wrapping

**Expected Result:** Long messages are handled appropriately

### Real-time Features

#### Test Case: Online Status
**Objective:** Verify online status indicators work

**Steps:**
1. [ ] Login and check online status indicator
2. [ ] Open second browser and login as different user
3. [ ] Verify both users show as online
4. [ ] Close one browser tab
5. [ ] Verify offline status updates

**Expected Result:** Online/offline status updates correctly

#### Test Case: Typing Indicators
**Objective:** Verify typing indicators work

**Steps:**
1. [ ] Open chat in two browser tabs with different users
2. [ ] Start typing in one tab
3. [ ] Verify "User is typing..." indicator appears in other tab
4. [ ] Stop typing
5. [ ] Verify indicator disappears

**Expected Result:** Typing indicators work in real-time

#### Test Case: Message Delivery Status
**Objective:** Verify message delivery status indicators

**Steps:**
1. [ ] Send a message
2. [ ] Check for delivery status indicators:
   - Sending (clock icon)
   - Delivered (single checkmark)
   - Read (double checkmark)

**Expected Result:** Message status indicators update correctly

### Connection Handling

#### Test Case: Connection Loss Recovery
**Objective:** Verify app handles connection loss gracefully

**Steps:**
1. [ ] Start chatting normally
2. [ ] Disconnect from internet
3. [ ] Try to send a message
4. [ ] Verify connection status indicator shows offline
5. [ ] Reconnect to internet
6. [ ] Verify connection is restored automatically
7. [ ] Check that pending messages are sent

**Expected Result:** Connection issues are handled gracefully with user feedback

#### Test Case: WebSocket Reconnection
**Objective:** Verify WebSocket reconnection works

**Steps:**
1. [ ] Open browser developer tools
2. [ ] Navigate to Network tab
3. [ ] Block WebSocket connections
4. [ ] Verify connection status shows disconnected
5. [ ] Unblock connections
6. [ ] Verify automatic reconnection occurs

**Expected Result:** WebSocket reconnects automatically

## Profile Management Testing

### Profile Display

#### Test Case: View Profile Information
**Objective:** Verify profile information displays correctly

**Steps:**
1. [ ] Login and navigate to profile page
2. [ ] Verify all profile fields are displayed:
   - Username
   - Email
   - Join date
   - Avatar (if uploaded)
3. [ ] Check that information matches registration data

**Expected Result:** Profile information displays correctly

### Profile Editing

#### Test Case: Update Username
**Objective:** Verify username can be updated

**Steps:**
1. [ ] Navigate to profile page
2. [ ] Click "Edit Profile" button
3. [ ] Change username to new value
4. [ ] Click "Save" button
5. [ ] Verify success message appears
6. [ ] Check username is updated in UI
7. [ ] Verify chat messages show new username

**Expected Result:** Username updates successfully

#### Test Case: Invalid Profile Updates
**Objective:** Verify validation for profile updates

**Steps:**
1. [ ] Try to update username to empty string
2. [ ] Verify error message appears
3. [ ] Try to use username that's already taken
4. [ ] Verify appropriate error message

**Expected Result:** Profile validation works correctly

### Avatar Management

#### Test Case: Upload Avatar
**Objective:** Verify avatar upload functionality

**Steps:**
1. [ ] Navigate to profile page
2. [ ] Click "Upload Avatar" button
3. [ ] Select valid image file (JPG/PNG)
4. [ ] Verify upload progress indicator
5. [ ] Check avatar preview updates
6. [ ] Save changes
7. [ ] Verify avatar appears in chat

**Expected Result:** Avatar uploads and displays correctly

#### Test Case: Invalid File Upload
**Objective:** Verify file type validation

**Steps:**
1. [ ] Try to upload invalid file type (e.g., .txt)
2. [ ] Verify error message about file type
3. [ ] Try to upload file that's too large
4. [ ] Verify error message about file size

**Expected Result:** File validation works correctly

## UI/UX Testing

### Navigation

#### Test Case: Menu Navigation
**Objective:** Verify all navigation links work

**Steps:**
1. [ ] Click each menu item and verify correct page loads:
   - Chat
   - Profile
   - Settings
2. [ ] Check active state highlighting
3. [ ] Verify breadcrumb navigation (if present)

**Expected Result:** All navigation works correctly

#### Test Case: Back Button Functionality
**Objective:** Verify browser back button works

**Steps:**
1. [ ] Navigate between pages using UI
2. [ ] Use browser back button
3. [ ] Verify correct page loads
4. [ ] Check that state is preserved

**Expected Result:** Browser navigation works correctly

### Theme and Styling

#### Test Case: Dark Mode Toggle
**Objective:** Verify dark mode functionality

**Steps:**
1. [ ] Locate theme toggle button
2. [ ] Click to switch to dark mode
3. [ ] Verify all elements switch to dark theme
4. [ ] Check that text remains readable
5. [ ] Switch back to light mode
6. [ ] Verify preference is saved

**Expected Result:** Theme switching works correctly

#### Test Case: Color Customization
**Objective:** Verify user color preferences work

**Steps:**
1. [ ] Navigate to profile/settings
2. [ ] Change text color using color picker
3. [ ] Change background color
4. [ ] Verify preview updates in real-time
5. [ ] Save changes
6. [ ] Check colors apply to chat messages

**Expected Result:** Color customization works correctly

### Form Interactions

#### Test Case: Form Field Focus States
**Objective:** Verify form fields respond correctly to focus

**Steps:**
1. [ ] Tab through all form fields
2. [ ] Verify focus indicators are visible
3. [ ] Check field highlighting works
4. [ ] Verify placeholder text behavior

**Expected Result:** Focus states work correctly

#### Test Case: Form Validation Visual Feedback
**Objective:** Verify validation errors are clearly visible

**Steps:**
1. [ ] Trigger validation errors on various fields
2. [ ] Check error message styling
3. [ ] Verify field border color changes
4. [ ] Check error icon indicators

**Expected Result:** Validation feedback is clear and accessible

## Responsive Design Testing

### Mobile Testing (375px width)

#### Test Case: Mobile Layout
**Objective:** Verify mobile layout works correctly

**Steps:**
1. [ ] Resize browser to 375px width
2. [ ] Check that all content is visible without horizontal scrolling
3. [ ] Verify navigation menu adapts (hamburger menu)
4. [ ] Test touch interactions on buttons
5. [ ] Check font sizes are readable

**Expected Result:** Mobile layout is fully functional

#### Test Case: Mobile Chat Interface
**Objective:** Verify chat works on mobile

**Steps:**
1. [ ] Open chat on mobile viewport
2. [ ] Send messages using touch keyboard
3. [ ] Verify messages display properly
4. [ ] Check scroll behavior
5. [ ] Test emoji picker (if present)

**Expected Result:** Chat interface works well on mobile

### Tablet Testing (768px width)

#### Test Case: Tablet Layout
**Objective:** Verify tablet layout

**Steps:**
1. [ ] Resize browser to 768px width
2. [ ] Check layout adapts appropriately
3. [ ] Verify sidebar behavior
4. [ ] Test both portrait and landscape orientations

**Expected Result:** Tablet layout is optimized

### Desktop Testing (1200px+ width)

#### Test Case: Desktop Layout
**Objective:** Verify desktop layout utilizes space well

**Steps:**
1. [ ] View on large desktop screen
2. [ ] Check content doesn't stretch too wide
3. [ ] Verify sidebar navigation is accessible
4. [ ] Test multi-column layouts (if present)

**Expected Result:** Desktop layout is well-optimized

## Performance Testing

### Loading Performance

#### Test Case: Initial Page Load
**Objective:** Verify page loads quickly

**Steps:**
1. [ ] Clear browser cache
2. [ ] Load application
3. [ ] Check Network tab in dev tools
4. [ ] Verify total load time is under 3 seconds
5. [ ] Check for unnecessary network requests

**Expected Result:** Page loads within acceptable time

#### Test Case: Image Loading
**Objective:** Verify images load efficiently

**Steps:**
1. [ ] Check avatar images load quickly
2. [ ] Verify lazy loading for message images (if present)
3. [ ] Test with slow network connection

**Expected Result:** Images load efficiently

### Memory Usage

#### Test Case: Memory Leaks
**Objective:** Verify no significant memory leaks

**Steps:**
1. [ ] Open browser dev tools, go to Memory tab
2. [ ] Take memory snapshot
3. [ ] Use application extensively (send many messages)
4. [ ] Take another memory snapshot
5. [ ] Compare memory usage

**Expected Result:** Memory usage remains reasonable

### Real-time Performance

#### Test Case: Many Messages Performance
**Objective:** Verify performance with many messages

**Steps:**
1. [ ] Send 100+ messages rapidly
2. [ ] Check for UI lag or freezing
3. [ ] Verify scrolling remains smooth
4. [ ] Test search functionality with many messages

**Expected Result:** Performance remains good with many messages

## Accessibility Testing

### Keyboard Navigation

#### Test Case: Tab Navigation
**Objective:** Verify complete keyboard navigation

**Steps:**
1. [ ] Use only Tab and Enter keys
2. [ ] Navigate through entire application
3. [ ] Verify all interactive elements are reachable
4. [ ] Check focus indicators are visible
5. [ ] Test escape key functionality in modals

**Expected Result:** Full keyboard accessibility

#### Test Case: Screen Reader Testing
**Objective:** Verify screen reader compatibility

**Steps:**
1. [ ] Enable screen reader (NVDA, JAWS, or VoiceOver)
2. [ ] Navigate through application
3. [ ] Verify all content is announced correctly
4. [ ] Check ARIA labels and roles
5. [ ] Test form field announcements

**Expected Result:** Screen reader works correctly

### Color and Contrast

#### Test Case: Color Contrast
**Objective:** Verify sufficient color contrast

**Steps:**
1. [ ] Use browser accessibility tools
2. [ ] Check contrast ratios for all text
3. [ ] Verify minimum 4.5:1 for normal text
4. [ ] Check 3:1 for large text
5. [ ] Test with dark mode enabled

**Expected Result:** All text meets contrast requirements

#### Test Case: Color-only Information
**Objective:** Verify information isn't conveyed by color alone

**Steps:**
1. [ ] Enable colorblind simulation
2. [ ] Check that status indicators have text/icons
3. [ ] Verify error states use more than just color
4. [ ] Test validation feedback accessibility

**Expected Result:** Information is accessible without color

## Browser Compatibility Testing

### Chrome Testing

#### Test Case: Chrome Functionality
**Steps:**
1. [ ] Test all features in latest Chrome
2. [ ] Check console for errors
3. [ ] Verify WebSocket connections work
4. [ ] Test file uploads

**Expected Result:** Full functionality in Chrome

### Firefox Testing

#### Test Case: Firefox Functionality
**Steps:**
1. [ ] Test all features in latest Firefox
2. [ ] Check for browser-specific issues
3. [ ] Verify CSS compatibility
4. [ ] Test WebSocket stability

**Expected Result:** Full functionality in Firefox

### Safari Testing

#### Test Case: Safari Functionality
**Steps:**
1. [ ] Test all features in Safari
2. [ ] Check WebKit-specific behaviors
3. [ ] Test on both macOS and iOS Safari
4. [ ] Verify touch interactions on iOS

**Expected Result:** Full functionality in Safari

### Edge Testing

#### Test Case: Edge Functionality
**Steps:**
1. [ ] Test all features in Microsoft Edge
2. [ ] Check compatibility with Chromium engine
3. [ ] Verify no legacy IE issues

**Expected Result:** Full functionality in Edge

## Error Handling Testing

### Network Errors

#### Test Case: API Errors
**Objective:** Verify API error handling

**Steps:**
1. [ ] Block API requests in dev tools
2. [ ] Try to perform actions requiring API calls
3. [ ] Verify user-friendly error messages
4. [ ] Check error logging

**Expected Result:** API errors are handled gracefully

#### Test Case: 404 Errors
**Objective:** Verify 404 page handling

**Steps:**
1. [ ] Navigate to non-existent URL
2. [ ] Verify 404 page displays
3. [ ] Check navigation options are available
4. [ ] Test return to homepage link

**Expected Result:** 404 errors are handled well

### Client-side Errors

#### Test Case: JavaScript Errors
**Objective:** Verify JavaScript error handling

**Steps:**
1. [ ] Monitor console for errors during testing
2. [ ] Check error boundaries catch errors
3. [ ] Verify application doesn't crash completely
4. [ ] Test error reporting functionality

**Expected Result:** JavaScript errors are handled gracefully

### User Input Errors

#### Test Case: Invalid Data Handling
**Objective:** Verify invalid user input handling

**Steps:**
1. [ ] Enter special characters in form fields
2. [ ] Try SQL injection attempts
3. [ ] Test XSS prevention
4. [ ] Verify data sanitization

**Expected Result:** Invalid input is properly handled

## Test Completion Checklist

### Pre-deployment Verification

- [ ] All authentication flows work correctly
- [ ] Chat functionality is fully operational
- [ ] Profile management works as expected
- [ ] UI/UX is polished and consistent
- [ ] Responsive design works on all screen sizes
- [ ] Performance is acceptable
- [ ] Accessibility requirements are met
- [ ] Browser compatibility is verified
- [ ] Error handling is comprehensive
- [ ] No console errors during normal usage
- [ ] All forms validate correctly
- [ ] Real-time features work reliably
- [ ] File uploads work properly
- [ ] Theme switching functions correctly
- [ ] Navigation is intuitive and functional

### Test Environment Notes

**Date:** ___________
**Tester:** ___________
**Browser:** ___________
**OS:** ___________
**Screen Resolution:** ___________

### Issues Found

| Issue | Severity | Steps to Reproduce | Expected Behavior | Actual Behavior |
|-------|----------|-------------------|-------------------|-----------------|
|       |          |                   |                   |                 |

### Test Summary

- **Total Tests Executed:** ___
- **Tests Passed:** ___
- **Tests Failed:** ___
- **Critical Issues:** ___
- **Minor Issues:** ___

### Sign-off

**Tester Signature:** ___________
**Date:** ___________
**Status:** ☐ Approved for Deployment ☐ Requires Fixes
