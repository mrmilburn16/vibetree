#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const KEY_ID = "C8U8M4U6DH";
const TEAM_ID = "3SFYC3VA37";
const BUNDLE_ID = "com.vibetree.musickit";
const KEY_FILENAME = "AuthKey_C8U8M4U6DH.p8";
const TOKEN_EXPIRY_DAYS = 180;

const keyPath = path.join(__dirname, KEY_FILENAME);

if (!fs.existsSync(keyPath)) {
  console.error("Error: Private key file not found.");
  console.error("Expected path:", keyPath);
  console.error("Place your AuthKey_C8U8M4U6DH.p8 file in the project root and run this script again.");
  process.exit(1);
}

const privateKey = fs.readFileSync(keyPath, "utf8");

const now = Math.floor(Date.now() / 1000);
const exp = now + TOKEN_EXPIRY_DAYS * 24 * 60 * 60;

const payload = {
  iss: TEAM_ID,
  iat: now,
  exp,
  sub: BUNDLE_ID,
};

const token = jwt.sign(payload, privateKey, {
  algorithm: "ES256",
  keyid: KEY_ID,
});

console.log(token);
console.log("");
console.log("Save this token in Vibetree Settings → App Secrets → WeatherKit. It expires in 180 days — regenerate before then.");
