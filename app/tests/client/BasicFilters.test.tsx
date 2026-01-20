import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import BasicFilters from "../../src/client/components/BasicFilters";

describe("BasicFilters", () => {
  afterEach(() => {
    cleanup();
  });

  describe("rendering", () => {
    it("should render all filter inputs", () => {
      render(<BasicFilters onApply={() => {}} />);
      expect(screen.getByLabelText(/min price/i)).toBeDefined();
      expect(screen.getByLabelText(/max price/i)).toBeDefined();
      expect(screen.getByLabelText(/min volume/i)).toBeDefined();
    });

    it("should render apply button", () => {
      render(<BasicFilters onApply={() => {}} />);
      expect(screen.getByRole("button", { name: /apply filters/i })).toBeDefined();
    });

    it("should not show clear button when no filters set", () => {
      render(<BasicFilters onApply={() => {}} />);
      expect(screen.queryByRole("button", { name: /clear/i })).toBeNull();
    });

    it("should show clear button when filters are set", () => {
      render(<BasicFilters onApply={() => {}} />);
      const minPriceInput = screen.getByLabelText(/min price/i);
      fireEvent.change(minPriceInput, { target: { value: "10" } });
      expect(screen.getByRole("button", { name: /clear/i })).toBeDefined();
    });
  });

  describe("filter application", () => {
    it("should call onApply with price min filter", () => {
      const onApply = vi.fn();
      render(<BasicFilters onApply={onApply} />);

      const minPriceInput = screen.getByLabelText(/min price/i);
      fireEvent.change(minPriceInput, { target: { value: "50" } });

      const applyButton = screen.getByRole("button", { name: /apply filters/i });
      fireEvent.click(applyButton);

      expect(onApply).toHaveBeenCalledWith([
        { field: "close", op: "gte", value: 50 },
      ]);
    });

    it("should call onApply with price max filter", () => {
      const onApply = vi.fn();
      render(<BasicFilters onApply={onApply} />);

      const maxPriceInput = screen.getByLabelText(/max price/i);
      fireEvent.change(maxPriceInput, { target: { value: "100" } });

      const applyButton = screen.getByRole("button", { name: /apply filters/i });
      fireEvent.click(applyButton);

      expect(onApply).toHaveBeenCalledWith([
        { field: "close", op: "lte", value: 100 },
      ]);
    });

    it("should call onApply with volume min filter", () => {
      const onApply = vi.fn();
      render(<BasicFilters onApply={onApply} />);

      const volumeInput = screen.getByLabelText(/min volume/i);
      fireEvent.change(volumeInput, { target: { value: "1000000" } });

      const applyButton = screen.getByRole("button", { name: /apply filters/i });
      fireEvent.click(applyButton);

      expect(onApply).toHaveBeenCalledWith([
        { field: "volume", op: "gte", value: 1000000 },
      ]);
    });

    it("should call onApply with multiple filters", () => {
      const onApply = vi.fn();
      render(<BasicFilters onApply={onApply} />);

      const minPriceInput = screen.getByLabelText(/min price/i);
      const maxPriceInput = screen.getByLabelText(/max price/i);
      const volumeInput = screen.getByLabelText(/min volume/i);

      fireEvent.change(minPriceInput, { target: { value: "10" } });
      fireEvent.change(maxPriceInput, { target: { value: "500" } });
      fireEvent.change(volumeInput, { target: { value: "100000" } });

      const applyButton = screen.getByRole("button", { name: /apply filters/i });
      fireEvent.click(applyButton);

      expect(onApply).toHaveBeenCalledWith([
        { field: "close", op: "gte", value: 10 },
        { field: "close", op: "lte", value: 500 },
        { field: "volume", op: "gte", value: 100000 },
      ]);
    });

    it("should call onApply with empty array when no valid filters", () => {
      const onApply = vi.fn();
      render(<BasicFilters onApply={onApply} />);

      const applyButton = screen.getByRole("button", { name: /apply filters/i });
      fireEvent.click(applyButton);

      expect(onApply).toHaveBeenCalledWith([]);
    });
  });

  describe("clear functionality", () => {
    it("should clear all inputs and call onApply with empty array", () => {
      const onApply = vi.fn();
      render(<BasicFilters onApply={onApply} />);

      // Set some values
      const minPriceInput = screen.getByLabelText(/min price/i);
      const maxPriceInput = screen.getByLabelText(/max price/i);
      fireEvent.change(minPriceInput, { target: { value: "10" } });
      fireEvent.change(maxPriceInput, { target: { value: "100" } });

      // Click clear
      const clearButton = screen.getByRole("button", { name: /clear/i });
      fireEvent.click(clearButton);

      // Should call onApply with empty array
      expect(onApply).toHaveBeenCalledWith([]);

      // Inputs should be cleared
      expect((minPriceInput as HTMLInputElement).value).toBe("");
      expect((maxPriceInput as HTMLInputElement).value).toBe("");
    });
  });

  describe("loading state", () => {
    it("should disable inputs when loading", () => {
      render(<BasicFilters onApply={() => {}} isLoading={true} />);

      expect(screen.getByLabelText(/min price/i)).toHaveProperty("disabled", true);
      expect(screen.getByLabelText(/max price/i)).toHaveProperty("disabled", true);
      expect(screen.getByLabelText(/min volume/i)).toHaveProperty("disabled", true);
    });

    it("should disable apply button when loading", () => {
      render(<BasicFilters onApply={() => {}} isLoading={true} />);
      expect(
        screen.getByRole("button", { name: /apply filters/i })
      ).toHaveProperty("disabled", true);
    });
  });
});
