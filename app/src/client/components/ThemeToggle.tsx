interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  const handleClick = () => {
    console.log("Toggle clicked, isDark:", isDark);
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        padding: "8px 16px",
        backgroundColor: isDark ? "#374151" : "#3b82f6",
        color: "white",
        borderRadius: "6px",
        border: "none",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
      }}
    >
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}
