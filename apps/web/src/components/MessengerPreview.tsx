"use client";
import { useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";
import { Avatar } from "./Avatar";
const people = [
  {
    name: "Ada",
    hue: 35,
    text: "Just us. I like that.",
    first: "You know that idea we talked about?",
    reply: "The one that's a little ahead of its time?",
    last: "That's the one. Let's build it. ✨",
  },
  {
    name: "Orion",
    hue: 190,
    text: "A quieter place to connect.",
    first: "A little less noise feels pretty good.",
    reply: "More room for the conversations that matter.",
    last: "Exactly what I was thinking.",
  },
  {
    name: "Nyx",
    hue: 290,
    text: "See you on the other side.",
    first: "Good ideas start with a conversation.",
    reply: "And a little space to be yourself.",
    last: "Welcome to our little corner of the internet.",
  },
];
export function MessengerPreview() {
  const [active, setActive] = useState(0);
  const person = people[active];
  return (
    <div className="hero-product">
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <div className="orbit-label">
        <span className="status-dot" /> YOUR SPACE, AFTER DARK
      </div>
      <div className="preview-window">
        <div className="preview-toolbar">
          <span className="preview-wordmark">
            <span>
              <Icon name="moon" size={15} />
            </span>{" "}
            nightmessenger.
          </span>
          <span className="tiny-label">
            LOCAL PREVIEW <span className="status-dot" />
          </span>
        </div>
        <div className="preview-body">
          <aside className="preview-sidebar">
            <div className="preview-title">
              Messages <Icon name="plus" size={14} />
            </div>
            <div className="preview-search">
              <Icon name="search" size={13} /> Search conversations
            </div>
            <p className="tiny-label preview-section-label">YOUR CIRCLE</p>
            {people.map((p, i) => (
              <button
                key={p.name}
                onClick={() => setActive(i)}
                className={`preview-person ${active === i ? "selected" : ""}`}
                aria-pressed={active === i}
                aria-label={`Preview conversation with ${p.name}`}
              >
                <Avatar name={p.name} hue={p.hue} size={32} />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.text}</small>
                </span>
                {i === 0 && <i />}
              </button>
            ))}
            <div className="preview-profile">
              <Avatar name="You" hue={75} size={28} />
              <span>
                Your little corner<small>Make yourself at home</small>
              </span>
            </div>
          </aside>
          <div className="preview-chat">
            <div className="preview-chat-head">
              <Avatar name={person.name} hue={person.hue} size={32} />
              <span>
                <strong>{person.name}</strong>
                <small>Demo conversation</small>
              </span>
              <Icon name="moon" size={16} />
            </div>
            <div className="preview-messages" key={person.name}>
              <span className="preview-day">TODAY</span>
              <div className="mini-bubble">
                {person.first}
                <small>10:41</small>
              </div>
              <div className="mini-bubble mine">
                {person.reply}
                <small>
                  10:42 <Icon name="check" size={10} />
                </small>
              </div>
              <div className="mini-bubble">
                {person.last}
                <small>10:42</small>
              </div>
              <div className="preview-typing" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
            <Link href="/app" className="preview-composer">
              <Icon name="plus" size={15} />
              <span>Say something good…</span>
              <span className="mini-send">
                <Icon name="arrow" size={15} />
              </span>
            </Link>
          </div>
        </div>
      </div>
      <div className="floating-note">
        <span className="note-icon">
          <Icon name="moon" size={22} />
        </span>
        <span>
          A little space for yourself.
          <small>No feeds. No followers. Just conversation.</small>
        </span>
        <span className="note-spark">✳</span>
      </div>
    </div>
  );
}
