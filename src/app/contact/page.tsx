"use client";

import { useState } from "react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { Button, Card, Input, Textarea, DropdownSelect } from "@/components/ui";

const SUBJECT_OPTIONS = [
  { value: "", label: "What's this about?" },
  { value: "general", label: "General inquiry" },
  { value: "sales", label: "Sales" },
  { value: "support", label: "Support" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
];

const MAX_MESSAGE_LENGTH = 2000;

function CheckIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[var(--semantic-success)]"
      aria-hidden
    >
      <path d="M12 24l8 8 16-20" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    if (!trimmedMessage) {
      setError("Please enter a message.");
      return;
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      setError("Message is too long.");
      return;
    }
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSendAnother() {
    setSubmitted(false);
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setError("");
  }

  return (
    <div className="min-h-screen bg-[var(--background-primary)]">
      <Nav />
      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-20">
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: "radial-gradient(ellipse 70% 50% at 50% 0%, var(--button-primary-bg), transparent)",
            }}
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <h1 className="text-heading-hero animate-fade-in mb-4">
              Get in touch
            </h1>
            <p className="text-body-muted text-lg">
              Have a question, idea, or want to say hi? We usually reply within 24 hours.
            </p>
          </div>
        </section>

        {/* Trust strip */}
        <section className="border-b border-[var(--border-default)] px-4 py-6 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-8 text-[var(--text-secondary)]">
            <span className="flex items-center gap-2 text-sm">
              <ClockIcon />
              Usually reply within 24 hours
            </span>
            <span className="flex items-center gap-2 text-sm">
              <MailIcon />
              <a href="mailto:hello@vibetree.com" className="text-[var(--link-default)] hover:text-[var(--link-hover)]">
                hello@vibetree.com
              </a>
            </span>
          </div>
        </section>

        {/* Form / Success */}
        <section className="px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-xl">
            {submitted ? (
              <Card className="animate-fade-in text-center py-14">
                <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--semantic-success)]/15 animate-success-check">
                  <CheckIcon />
                </div>
                <h2 className="text-heading-section mb-2">Thanks for reaching out</h2>
                <p className="text-body-muted mb-8 max-w-sm mx-auto">
                  We&apos;ve received your message and will get back to you within 24 hours.
                </p>
                <Button variant="secondary" onClick={handleSendAnother}>
                  Send another message
                </Button>
              </Card>
            ) : (
              <Card className="animate-fade-in p-6 sm:p-8">
                <h2 className="text-heading-card mb-1">Send a message</h2>
                <p className="text-body-muted mb-6 text-sm">
                  Fill out the form below and we&apos;ll get back to you soon.
                </p>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="contact-name" className="text-body-muted mb-1.5 block text-sm font-medium">
                        Name
                      </label>
                      <Input
                        id="contact-name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        disabled={loading}
                      />
                    </div>
                    <div>
                      <label htmlFor="contact-email" className="text-body-muted mb-1.5 block text-sm font-medium">
                        Email
                      </label>
                      <Input
                        id="contact-email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <div>
                    <label id="contact-subject-label" className="text-body-muted mb-1.5 block text-sm font-medium">
                      Subject
                    </label>
                    <DropdownSelect
                      options={SUBJECT_OPTIONS}
                      value={subject}
                      onChange={setSubject}
                      className="w-full min-w-0"
                      aria-label="Subject"
                    />
                  </div>
                  <div>
                    <div className="text-body-muted mb-1.5 flex justify-between text-sm">
                      <label htmlFor="contact-message">Message</label>
                      <span className={message.length > MAX_MESSAGE_LENGTH ? "text-[var(--semantic-error)]" : ""}>
                        {message.length}/{MAX_MESSAGE_LENGTH}
                      </span>
                    </div>
                    <Textarea
                      id="contact-message"
                      placeholder="How can we help?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      maxLength={MAX_MESSAGE_LENGTH + 100}
                      disabled={loading}
                      className="min-h-[120px] resize-y"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-[var(--semantic-error)]" role="alert">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? "Sending…" : "Send message"}
                  </Button>
                </form>
              </Card>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
