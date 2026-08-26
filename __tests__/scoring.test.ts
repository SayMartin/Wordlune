import {
  BASE_POINTS,
  MAX_GUESSES,
  MAX_TIME_BONUS,
  computeWordScore,
  explainStoredScore,
  formatDuration,
  freeSeconds,
  guessPoints,
  timeBonus,
} from "../src/utils/scoring";

describe("guessPoints", () => {
  it("pays full for a first-guess solve and steps down by 10", () => {
    expect(guessPoints(1)).toBe(100);
    expect(guessPoints(3)).toBe(80);
    expect(guessPoints(MAX_GUESSES)).toBe(50);
  });

  it("clamps out-of-range guess counts instead of producing nonsense", () => {
    expect(guessPoints(0)).toBe(100);
    expect(guessPoints(99)).toBe(50);
  });
});

describe("timeBonus", () => {
  it("is full anywhere inside the per-letter allowance", () => {
    expect(freeSeconds(5)).toBe(50);
    expect(timeBonus(0, 5)).toBe(MAX_TIME_BONUS);
    expect(timeBonus(50, 5)).toBe(MAX_TIME_BONUS);
  });

  it("decays one point per two seconds of overtime", () => {
    expect(timeBonus(60, 5)).toBe(45);
    expect(timeBonus(70, 5)).toBe(40);
  });

  it("never goes negative", () => {
    expect(timeBonus(10_000, 5)).toBe(0);
  });

  it("scales the allowance with word length, so a long word is not punished", () => {
    // 60s on a 12-letter word is still inside its 120s allowance.
    expect(timeBonus(60, 12)).toBe(MAX_TIME_BONUS);
  });
});

describe("computeWordScore", () => {
  it("adds the two halves together", () => {
    const b = computeWordScore({ won: true, guesses: 4, durationSeconds: 60, wordLength: 5 });
    expect(b.guessPoints).toBe(70);
    expect(b.timeBonus).toBe(45);
    expect(b.total).toBe(115);
  });

  it("scores nothing for a word that was not solved, but keeps the inputs", () => {
    const b = computeWordScore({ won: false, guesses: 6, durationSeconds: 30, wordLength: 5 });
    expect(b.total).toBe(0);
    expect(b.guessPoints).toBe(0);
    expect(b.timeBonus).toBe(0);
    expect(b.guesses).toBe(6);
    expect(b.durationSeconds).toBe(30);
  });

  it("treats a missing duration as zero rather than NaN", () => {
    const b = computeWordScore({ won: true, guesses: 1, durationSeconds: NaN, wordLength: 5 });
    expect(b.total).toBe(BASE_POINTS + MAX_TIME_BONUS);
  });
});

describe("explainStoredScore", () => {
  it("confirms a row the current formula reproduces", () => {
    const e = explainStoredScore({ score: 115, guesses_count: 4, duration_seconds: 60, word: "APPLE" });
    expect(e.matchesStored).toBe(true);
    expect(e.total).toBe(115);
  });

  it("flags a row saved before the time bonus existed", () => {
    // The old formula capped at 100; nothing the current one produces for a
    // solved word can be that low with a full time bonus available.
    const e = explainStoredScore({ score: 70, guesses_count: 4, duration_seconds: 60, word: "APPLE" });
    expect(e.matchesStored).toBe(false);
    expect(e.storedScore).toBe(70);
  });

  it("falls back to max_letters when the word is missing", () => {
    const e = explainStoredScore({ score: 150, guesses_count: 1, duration_seconds: 10, max_letters: 8 });
    expect(e.matchesStored).toBe(true);
  });
});

describe("formatDuration", () => {
  it("pads seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(600)).toBe("10:00");
  });
});
