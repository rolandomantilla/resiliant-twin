import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import { Route } from "@/routes/_protected/index";

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: () => ({
    data: { databaseEnabled: false, s3Enabled: false },
    isLoading: false,
  }),
}));

const DashboardPage = Route.options.component as () => React.ReactElement;

describe("ResilienceTwin dispatch dashboard", () => {
  it("tells the user the database isn't configured instead of crashing", () => {
    renderWithProviders(<DashboardPage />);

    expect(screen.getByText(/Database not configured/)).toBeInTheDocument();
  });
});
