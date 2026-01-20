import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import TickerInput from "../../src/client/components/TickerInput";

describe("TickerInput", () => {
  afterEach(() => {
    cleanup();
  });

  it("should render input and button", () => {
    render(<TickerInput onScan={() => {}} />);
    expect(screen.getByPlaceholderText(/enter tickers/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /scan/i })).toBeDefined();
  });

  it("should disable button when input is empty", () => {
    render(<TickerInput onScan={() => {}} />);
    const button = screen.getByRole("button", { name: /scan/i });
    expect(button).toHaveProperty("disabled", true);
  });

  it("should enable button when input has value", () => {
    render(<TickerInput onScan={() => {}} />);
    const input = screen.getByPlaceholderText(/enter tickers/i);
    fireEvent.change(input, { target: { value: "AAPL" } });
    const button = screen.getByRole("button", { name: /scan/i });
    expect(button).toHaveProperty("disabled", false);
  });

  it("should show ticker count", () => {
    render(<TickerInput onScan={() => {}} />);
    const input = screen.getByPlaceholderText(/enter tickers/i);
    fireEvent.change(input, { target: { value: "AAPL, MSFT, GOOGL" } });
    expect(screen.getByText(/3 tickers/i)).toBeDefined();
  });

  it("should call onScan with parsed tickers on submit", () => {
    const onScan = vi.fn();
    render(<TickerInput onScan={onScan} />);

    const input = screen.getByPlaceholderText(/enter tickers/i);
    fireEvent.change(input, { target: { value: "aapl, msft, googl" } });

    const button = screen.getByRole("button", { name: /scan/i });
    fireEvent.click(button);

    expect(onScan).toHaveBeenCalledWith(["AAPL", "MSFT", "GOOGL"]);
  });

  it("should show loading state", () => {
    render(<TickerInput onScan={() => {}} isLoading={true} />);
    expect(screen.getByRole("button", { name: /scanning/i })).toBeDefined();
  });

  it("should disable input and button when loading", () => {
    render(<TickerInput onScan={() => {}} isLoading={true} />);
    const input = screen.getByPlaceholderText(/enter tickers/i);
    const button = screen.getByRole("button", { name: /scanning/i });
    expect(input).toHaveProperty("disabled", true);
    expect(button).toHaveProperty("disabled", true);
  });

  it("should handle whitespace in tickers", () => {
    const onScan = vi.fn();
    render(<TickerInput onScan={onScan} />);

    const input = screen.getByPlaceholderText(/enter tickers/i);
    fireEvent.change(input, { target: { value: "  aapl  ,  msft  " } });

    const button = screen.getByRole("button", { name: /scan/i });
    fireEvent.click(button);

    expect(onScan).toHaveBeenCalledWith(["AAPL", "MSFT"]);
  });

  it("should filter empty tickers", () => {
    const onScan = vi.fn();
    render(<TickerInput onScan={onScan} />);

    const input = screen.getByPlaceholderText(/enter tickers/i);
    fireEvent.change(input, { target: { value: "AAPL,,MSFT,," } });

    const button = screen.getByRole("button", { name: /scan/i });
    fireEvent.click(button);

    expect(onScan).toHaveBeenCalledWith(["AAPL", "MSFT"]);
  });
});
