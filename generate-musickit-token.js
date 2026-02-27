#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

// MusicKit developer token: JWT has iss, iat, exp (no sub).
const KEY_ID = "XQ3VJ2Y8UU";
const TEAM_ID = "3SFYC3VA37";
const KEY_FILENAME = "AuthKey_XQ3VJ2Y8UU.p8";
const TOKEN_EXPIRY_DAYS = 180;

let keyPath = path.join(__dirname, KEY_FILENAME);
if (!fs.existsSync(keyPath)) {
  const downloadsPath = path.join(process.env.HOME || "", "Downloads", KEY_FILENAME);
  if (fs.existsSync(downloadsPath)) keyPath = downloadsPath;
}
if (!fs.existsSync(keyPath)) {
  console.error("Error: Private key file not found.");
  console.error("Expected path:", path.join(__dirname, KEY_FILENAME));
  console.error("Also checked:", path.join(process.env.HOME || "", "Downloads", KEY_FILENAME));
  console.error("Place your .p8 key file in the project root or Downloads and run this script again.");
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, "utf8");

const now = Math.floor(Date.now() / 1000);
const exp = now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
};

const token = jwt.sign(payload, privateKey, {
  algorithm: "ES256",
  keyid: KEY_ID,
});

console.log(token);
