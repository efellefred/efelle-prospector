'use strict';

const VERDICT_CLASS = {
  good: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  bad: "bg-red-100 text-red-800 border-red-200",
  unknown: "bg-slate-100 text-slate-600 border-slate-200",
};

function verdictClass(v) {
  return VERDICT_CLASS[v];
}

const VERDICT_TEXT_CLASS = {
  good: "text-emerald-700",
  warning: "text-amber-700",
  bad: "text-red-700",
  unknown: "text-slate-700",
};

function verdictTextClass(v) {
  return VERDICT_TEXT_CLASS[v];
}

function fcpVerdict(fcpSec) {
  if (fcpSec == null) return "unknown";
  if (fcpSec <= 1.8) return "good";
  if (fcpSec <= 3.0) return "warning";
  return "bad";
}

function performanceVerdict(score) {
  if (score == null) return "unknown";
  if (score >= 90) return "good";
  if (score >= 50) return "warning";
  return "bad";
}

function lcpVerdict(lcpSec) {
  if (lcpSec == null) return "unknown";
  if (lcpSec <= 2.5) return "good";
  if (lcpSec <= 4.0) return "warning";
  return "bad";
}

function clsVerdict(cls) {
  if (cls == null) return "unknown";
  if (cls <= 0.1) return "good";
  if (cls <= 0.25) return "warning";
  return "bad";
}

function wordCountVerdict(words) {
  if (words >= 1200) return "good";
  if (words >= 600) return "warning";
  return "bad";
}

function altTextVerdict(issues) {
  if (issues === 0) return "good";
  if (issues <= 5) return "warning";
  return "bad";
}

function reviewCountVerdict(count) {
  if (count == null) return "unknown";
  if (count >= 25) return "good";
  if (count >= 10) return "warning";
  return "bad";
}

function ratingVerdict(rating) {
  if (rating == null) return "unknown";
  if (rating >= 4.5) return "good";
  if (rating >= 4.0) return "warning";
  return "bad";
}

function boolVerdict(value) {
  if (value === undefined) return "unknown";
  return value ? "good" : "bad";
}

function gbpCompleteVerdict(record) {
  if (!record.local) return "unknown";
  return record.local.google_business_profile.is_complete ? "good" : "bad";
}

function readingEaseVerdict(score) {
  if (score == null) return "unknown";
  if (score >= 60) return "good"; // 8th-9th grade -- accessible to broad audiences
  if (score >= 30) return "warning"; // 10th-college level
  return "bad"; // college graduate / very dense
}

function readingAgeVerdict(age) {
  if (age == null) return "unknown";
  if (age <= 14) return "good";
  if (age <= 18) return "warning";
  return "bad";
}

function geoScoreVerdict(score) {
  if (score == null) return "unknown";
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  return "bad";
}

module.exports = {
  verdictClass,
  verdictTextClass,
  fcpVerdict,
  performanceVerdict,
  lcpVerdict,
  clsVerdict,
  wordCountVerdict,
  altTextVerdict,
  reviewCountVerdict,
  ratingVerdict,
  boolVerdict,
  gbpCompleteVerdict,
  readingEaseVerdict,
  readingAgeVerdict,
  geoScoreVerdict,
};
