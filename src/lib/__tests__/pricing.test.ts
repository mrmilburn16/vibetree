import { describe, it, expect } from "vitest";
import { CREDIT_USAGE, PLANS, DEFAULT_PLAN_ID } from "../pricing";

describe("CREDIT_USAGE", () => {
  it("has positive integer values for all usage types", () => {
    for (const [key, value] of Object.entries(CREDIT_USAGE)) {
      expect(value, `${key} should be positive`).toBeGreaterThan(0);
      expect(Number.isInteger(value), `${key} should be integer`).toBe(true);
    }
  });

  it("premium messages cost more than standard", () => {
    expect(CREDIT_USAGE.MESSAGE_PREMIUM).toBeGreaterThan(
      CREDIT_USAGE.MESSAGE_STANDARD
    );
  });

  it("publish costs more than build", () => {
    expect(CREDIT_USAGE.PUBLISH).toBeGreaterThan(CREDIT_USAGE.BUILD);
  });
});

describe("PLANS", () => {
  it("has exactly 3 plans", () => {
    expect(PLANS).toHaveLength(3);
  });

  it("includes creator, pro, and team", () => {
    const ids = PLANS.map((p) => p.id);
    expect(ids).toContain("creator");
    expect(ids).toContain("pro");
    expect(ids).toContain("team");
  });

  it("creator plan is free", () => {
    const creator = PLANS.find((p) => p.id === "creator")!;
    expect(creator.monthlyPrice).toBe(0);
    expect(creator.annualPrice).toBe(0);
    expect(creator.hasFreeTrial).toBe(false);
  });

  it("pro plan has a 14-day free trial", () => {
    const pro = PLANS.find((p) => p.id === "pro")!;
    expect(pro.hasFreeTrial).toBe(true);
    expect(pro.freeTrialDays).toBe(14);
  });

  it("team plan has highest credits", () => {
    const credits = PLANS.map((p) => p.creditsPerMonth ?? 0);
    const team = PLANS.find((p) => p.id === "team")!;
    expect(team.creditsPerMonth).toBe(Math.max(...credits));
  });

  it("annual price is cheaper than 12x monthly for paid plans", () => {
    for (const plan of PLANS) {
      if (plan.monthlyPrice && plan.annualPrice) {
        expect(plan.annualPrice).toBeLessThan(plan.monthlyPrice * 12);
      }
    }
  });

  it("all plans have at least one feature", () => {
    for (const plan of PLANS) {
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});

describe("DEFAULT_PLAN_ID", () => {
  it("refers to a valid plan", () => {
    const ids = PLANS.map((p) => p.id);
    expect(ids).toContain(DEFAULT_PLAN_ID);
  });

  it("defaults to creator (free plan)", () => {
    expect(DEFAULT_PLAN_ID).toBe("creator");
  });
});
