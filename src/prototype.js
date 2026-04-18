import { gsap } from "gsap";

const copy = {
  eyebrow: "HACKATHON DEMO",
  title: "Split the bill with a claw.",
  body:
    "Drop in any image later. For the pitch, the lobster claws in, slices the frame, and throws the halves apart with a little swagger.",
  kicker: "INPUT: image only",
  statLabel: "dramatic split",
  statValue: "0.8s",
  badge: "Agent Bill",
};

export function createLobsterSplitDemo(root, { imageSrc }) {
  root.innerHTML = `
    <main class="stage-shell">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">${copy.eyebrow}</p>
          <h1>${copy.title}</h1>
          <p class="body-copy">${copy.body}</p>
          <div class="meta-row">
            <span class="meta-pill meta-pill--accent">${copy.kicker}</span>
            <span class="meta-pill">${copy.badge}</span>
          </div>
        </div>

        <div class="stage-card">
          <div class="ambient ambient--one"></div>
          <div class="ambient ambient--two"></div>
          <div class="ticket" aria-hidden="true">APR · BALANCE</div>

          <div class="preview-frame" data-preview-frame>
            <div class="preview-halo"></div>
            <div class="preview-shadow"></div>

            <div class="image-stack">
              <div class="image-half image-half--left" data-half="left">
                <img src="${imageSrc}" alt="Prototype target" />
              </div>
              <div class="image-half image-half--right" data-half="right">
                <img src="${imageSrc}" alt="" />
              </div>
            </div>

            <div class="cut-slash" data-cut-slash></div>
            <div class="cut-glow" data-cut-glow></div>

            <div class="burst burst--center" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div class="paper-shards" aria-hidden="true">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>

            <img
              class="claw"
              data-claw
              src="/assets/lobster-claw.png"
              alt=""
            />

            <div class="caption-bar">
              <div>
                <p class="caption-label">PENNY MODE</p>
                <p class="caption-title">Split. Snip. Settled.</p>
              </div>
              <button class="replay-button" type="button" data-replay>
                Replay
              </button>
            </div>
          </div>

          <div class="stat-chip">
            <span>${copy.statLabel}</span>
            <strong>${copy.statValue}</strong>
          </div>
        </div>
      </section>
    </main>
  `;

  const frame = root.querySelector("[data-preview-frame]");
  const claw = root.querySelector("[data-claw]");
  const leftHalf = root.querySelector('[data-half="left"]');
  const rightHalf = root.querySelector('[data-half="right"]');
  const slash = root.querySelector("[data-cut-slash]");
  const glow = root.querySelector("[data-cut-glow]");
  const burst = root.querySelector(".burst");
  const burstPieces = burst.querySelectorAll("span");
  const paperShards = root.querySelectorAll(".paper-shards span");
  const replayButton = root.querySelector("[data-replay]");

  const setBaseState = () => {
    gsap.set(frame, { rotate: -4, scale: 0.92, y: 24, opacity: 0 });
    gsap.set(claw, {
      x: 80,
      y: -8,
      rotate: -6,
      scaleX: -1,
      scaleY: 1,
      transformOrigin: "86% 48%",
      opacity: 1,
    });
    gsap.set(leftHalf, {
      clipPath: "polygon(0 0, 58% 0, 48% 100%, 0 100%)",
      x: 0,
      y: 0,
      rotate: 0,
      transformOrigin: "55% 50%",
      filter: "drop-shadow(0 18px 24px rgba(0, 0, 0, 0.18))",
    });
    gsap.set(rightHalf, {
      clipPath: "polygon(52% 0, 100% 0, 100% 100%, 42% 100%)",
      x: 0,
      y: 0,
      rotate: 0,
      transformOrigin: "45% 50%",
      filter: "drop-shadow(0 18px 24px rgba(0, 0, 0, 0.18))",
    });
    gsap.set(slash, {
      opacity: 0,
      scaleY: 0,
      rotate: -6,
      transformOrigin: "center center",
    });
    gsap.set(glow, {
      opacity: 0,
      scale: 0.3,
      xPercent: -50,
      yPercent: -50,
    });
    gsap.set(burst, { scale: 0.4, opacity: 0 });
    gsap.set(burstPieces, {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 1,
      transformOrigin: "center center",
    });
    gsap.set(paperShards, {
      x: 0,
      y: 0,
      rotate: 0,
      scale: 0.7,
      opacity: 0,
      transformOrigin: "center center",
    });
    gsap.set(".caption-bar", { y: 24, opacity: 0 });
    gsap.set(".stat-chip", { y: 14, opacity: 0 });
    gsap.set(".ticket", { y: -18, rotate: 7, opacity: 0 });
    gsap.set(".hero-copy > *", { y: 18, opacity: 0 });
  };

  const timeline = gsap.timeline({
    paused: true,
    defaults: {
      ease: "power3.out",
    },
  });

  setBaseState();

  timeline
    .to(".hero-copy > *", {
      y: 0,
      opacity: 1,
      duration: 0.7,
      stagger: 0.08,
    })
    .to(
      frame,
      {
        y: 0,
        rotate: 0,
        scale: 1,
        opacity: 1,
        duration: 0.9,
        ease: "elastic.out(1, 0.8)",
      },
      0.1,
    )
    .to(
      ".ticket",
      {
        opacity: 1,
        y: 0,
        rotate: -4,
        duration: 0.45,
      },
      0.48,
    )
    .to(
      ".caption-bar, .stat-chip",
      {
        y: 0,
        opacity: 1,
        duration: 0.45,
        stagger: 0.08,
      },
      0.62,
    )
    .to(
      claw,
      {
        x: -56,
        y: -8,
        rotate: -4,
        duration: 0.24,
        ease: "power2.out",
      },
      0.72,
    )
    .to(
      claw,
      {
        keyframes: [
          { x: -62, y: -10, rotate: -18, duration: 0.18 },
          { x: -48, y: -6, rotate: 10, duration: 0.18 },
          { x: -64, y: -11, rotate: -15, duration: 0.18 },
          { x: -50, y: -7, rotate: 7, duration: 0.16 },
          { x: -56, y: -8, rotate: -4, duration: 0.14 },
        ],
        ease: "sine.inOut",
      },
      0.98,
    )
    .to(
      claw,
      {
        x: -120,
        y: 0,
        rotate: -12,
        scaleX: -1,
        scaleY: 1,
        duration: 0.52,
        ease: "back.out(1.9)",
      },
      1.92,
    )
    .to(
      claw,
      {
        keyframes: [
          {
            rotate: -21,
            x: -150,
            y: 7,
            duration: 0.08,
          },
          {
            rotate: -9,
            x: -116,
            y: -1,
            duration: 0.1,
          },
          {
            rotate: -17,
            x: -138,
            y: 4,
            duration: 0.09,
          },
        ],
        ease: "power4.inOut",
      },
      2.44,
    )
    .to(
      slash,
      {
        opacity: 1,
        scaleY: 1.18,
        duration: 0.09,
        ease: "power4.out",
      },
      2.48,
    )
    .to(
      glow,
      {
        opacity: 0.95,
        scale: 1,
        duration: 0.12,
        ease: "power2.out",
      },
      2.48,
    )
    .to(
      burst,
      {
        opacity: 1,
        scale: 1.18,
        duration: 0.18,
        ease: "power2.out",
      },
      2.5,
    )
    .to(
      burstPieces,
      {
        keyframes: [
          { x: (_, target) => target.dataset.x1, y: (_, target) => target.dataset.y1, rotate: 12, duration: 0.1 },
          { x: (_, target) => target.dataset.x2, y: (_, target) => target.dataset.y2, rotate: -22, scale: 0.12, duration: 0.42 },
        ],
        stagger: 0.015,
        ease: "power2.out",
      },
      2.5,
    )
    .to(
      paperShards,
      {
        keyframes: [
          {
            opacity: 1,
            x: (_, target) => target.dataset.x1,
            y: (_, target) => target.dataset.y1,
            rotate: (_, target) => target.dataset.r1,
            scale: 1.04,
            duration: 0.14,
          },
          {
            opacity: 1,
            x: (_, target) => target.dataset.xHold,
            y: (_, target) => target.dataset.yHold,
            rotate: (_, target) => target.dataset.rHold,
            scale: 0.92,
            duration: 0.24,
          },
          {
            opacity: 0,
            x: (_, target) => target.dataset.x2,
            y: (_, target) => target.dataset.y2,
            rotate: (_, target) => target.dataset.r2,
            scale: 0.42,
            duration: 0.72,
          },
        ],
        stagger: 0.03,
        ease: "power2.out",
      },
      2.49,
    )
    .to(
      [leftHalf, rightHalf],
      {
        keyframes: [
          {
            x: (_, target) => (target === leftHalf ? -28 : 28),
            y: -10,
            duration: 0.07,
            ease: "power2.out",
          },
          {
            x: (_, target) => (target === leftHalf ? -126 : 126),
            y: (_, target) => (target === leftHalf ? 30 : -24),
            rotate: (_, target) => (target === leftHalf ? -18 : 18),
            duration: 0.5,
            ease: "power3.out",
          },
          {
            x: (_, target) => (target === leftHalf ? -112 : 112),
            y: (_, target) => (target === leftHalf ? 24 : -18),
            rotate: (_, target) => (target === leftHalf ? -15 : 15),
            duration: 0.28,
            ease: "back.out(1.6)",
          },
        ],
      },
      2.52,
    )
    .to(
      frame,
      {
        keyframes: [
          { x: 18, rotate: 1.9, duration: 0.06 },
          { x: -15, rotate: -1.7, duration: 0.08 },
          { x: 10, rotate: 0.9, duration: 0.07 },
          { x: 0, rotate: 0, duration: 0.16 },
        ],
        ease: "power2.inOut",
      },
      2.52,
    )
    .to(
      claw,
      {
        x: 140,
        y: -12,
        rotate: -3,
        scaleX: -1,
        scaleY: 1,
        duration: 0.34,
        ease: "power3.in",
      },
      2.68,
    )
    .to(
      slash,
      {
        opacity: 0,
        scaleY: 0,
        duration: 0.14,
      },
      2.74,
    )
    .to(
      glow,
      {
        opacity: 0.32,
        scale: 1.3,
        duration: 0.24,
        ease: "power2.out",
      },
      2.58,
    )
    .to(
      glow,
      {
        opacity: 0,
        scale: 1.55,
        duration: 0.9,
        ease: "sine.out",
      },
      2.84,
    )
    .to(
      burst,
      {
        opacity: 0,
        duration: 0.24,
      },
      2.82,
    )
    .to(
      [leftHalf, rightHalf],
      {
        y: (_, target) => (target === leftHalf ? 8 : -8),
        duration: 1.3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      },
      3.2,
    );

  burstPieces.forEach((piece, index) => {
    const positions = [
      ["-16", "-34", "-32", "-74"],
      ["14", "-36", "36", "-88"],
      ["30", "-10", "86", "-14"],
      ["-34", "-6", "-92", "0"],
      ["-18", "22", "-44", "62"],
      ["22", "28", "52", "78"],
    ];
    const [x1, y1, x2, y2] = positions[index];
    piece.dataset.x1 = x1;
    piece.dataset.y1 = y1;
    piece.dataset.x2 = x2;
    piece.dataset.y2 = y2;
  });

  paperShards.forEach((piece, index) => {
    const positions = [
      ["-20", "-12", "-46", "-24", "-84", "-44", "-14", "-28", "-42"],
      ["18", "-26", "42", "-48", "72", "-96", "18", "34", "58"],
      ["26", "4", "54", "10", "104", "10", "22", "52", "96"],
      ["-10", "18", "-18", "48", "-32", "92", "-28", "22", "124"],
      ["12", "24", "26", "48", "58", "86", "34", "16", "-76"],
    ];
    const [x1, y1, xHold, yHold, x2, y2, r1, rHold, r2] = positions[index];
    piece.dataset.x1 = x1;
    piece.dataset.y1 = y1;
    piece.dataset.xHold = xHold;
    piece.dataset.yHold = yHold;
    piece.dataset.x2 = x2;
    piece.dataset.y2 = y2;
    piece.dataset.r1 = r1;
    piece.dataset.rHold = rHold;
    piece.dataset.r2 = r2;
  });

  replayButton.addEventListener("click", () => {
    timeline.pause(0);
    setBaseState();
    timeline.play(0);
  });

  timeline.play(0);
}
