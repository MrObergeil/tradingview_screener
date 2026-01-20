import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import App from "../../src/client/App";

describe("App", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render the heading", () => {
    render(<App />);
    expect(screen.getByText("TV Screener+")).toBeDefined();
  });

  it("should render Enter Tickers section", () => {
    render(<App />);
    expect(screen.getByText("Enter Tickers")).toBeDefined();
  });

  it("should render TickerInput component", () => {
    render(<App />);
    expect(screen.getByPlaceholderText(/enter tickers/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /scan/i })).toBeDefined();
  });
});
