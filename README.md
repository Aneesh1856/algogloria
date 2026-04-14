# Hackathon Portal - Setup Guide

Hey! Here is the code for the Hackathon Portal. Follow these simple steps to get the website running on your local machine.

## Prerequisites

1.  **Node.js**: Make sure you have [Node.js](https://nodejs.org/) installed on your computer.

## How to Run the Website

### Step 1: Open the Project
Open your Terminal (Mac/Linux) or Command Prompt / PowerShell (Windows) and navigate into this exact folder (where this README is located).

### Step 2: Install Dependencies
Run the following command to download all the code libraries the project needs:

```bash
npm install
```

### Step 3: Check Environment Variables
Make sure the `.env.local` file is present in this folder. This file contains the private Firebase database keys. 
**If it's missing, ask me to send it to you!** *(Without this file, the login, database, and website won't work).*

### Step 4: Start the Server
Once everything is installed, start the website by running:

```bash
npx next dev
```

### Step 5: View the Website
Open your web browser and go to: **[http://localhost:3000](http://localhost:3000)**

---

## Pages in the App

If you want to check out specific parts of the website, here are the main routes:
- **Home/Landing (`/`)**: The main screen with the countdown and leaderboard.
- **Admin Panel (`/admin`)**: The control center for managing the hackathon. 
- **Evaluator Panel (`/evaluator`)**: The portal where judges can score different teams.
- **Participant Dashboard (`/dashboard`)**: Where the hackathon teams can see their tasks and progress.
