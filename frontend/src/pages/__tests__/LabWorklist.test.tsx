import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as laboratoryService from "../../services/laboratory";
import { LabWorklist } from "../LabWorklist";

vi.mock("../../services/laboratory");

const mockedListLabWorklist = vi.mocked(laboratoryService.listLabWorklist);
const mockedUpdateStatus = vi.mocked(laboratoryService.updateLabRequestStatus);
const mockedRecordResult = vi.mocked(laboratoryService.recordLabResult);
const mockedValidateResult = vi.mocked(laboratoryService.validateLabResult);

const baseRequest = {
  id: "req-1",
  patient: "patient-1",
  patient_name: "Ama Mensah",
  consultation: "consult-1",
  test: 1,
  test_name: "Malaria RDT",
  test_code: "MAL-RDT",
  priority: "normal" as const,
  notes: "",
  requested_by_name: "Dr. Owusu",
  sample_collected_at: null,
  completed_at: null,
  created_at: "",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <LabWorklist />
    </MemoryRouter>,
  );
}

describe("LabWorklist", () => {
  beforeEach(() => {
    mockedListLabWorklist.mockReset();
    mockedUpdateStatus.mockReset();
    mockedRecordResult.mockReset();
    mockedValidateResult.mockReset();
  });

  it("lets a technician collect a sample for a requested test", async () => {
    mockedListLabWorklist.mockResolvedValue([
      { ...baseRequest, status: "requested", has_result: false },
    ]);
    mockedUpdateStatus.mockResolvedValueOnce({
      ...baseRequest,
      status: "sample_collected",
      has_result: false,
      sample_collected_at: "2026-09-04T10:00:00Z",
    });

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /collect sample/i }));

    await waitFor(() =>
      expect(mockedUpdateStatus).toHaveBeenCalledWith("req-1", "sample_collected"),
    );
  });

  it("lets a technician enter and then validate a result", async () => {
    mockedListLabWorklist.mockResolvedValue([
      { ...baseRequest, status: "sample_collected", has_result: false },
    ]);
    mockedRecordResult.mockResolvedValueOnce({
      id: "result-1",
      result_value: "Negative",
      is_abnormal: false,
      notes: "",
      performed_by_name: "Tech",
      validated_by_name: null,
      validated_at: null,
      pending_validation: true,
      created_at: "",
    });

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /enter result/i }));
    await userEvent.type(screen.getByLabelText(/^result$/i), "Negative");
    await userEvent.click(screen.getByRole("button", { name: /save result/i }));

    await waitFor(() => expect(mockedRecordResult).toHaveBeenCalledWith("req-1", {
      result_value: "Negative",
      is_abnormal: false,
    }));
  });

  it("shows a Validate action once a result has been entered", async () => {
    mockedListLabWorklist.mockResolvedValue([
      { ...baseRequest, status: "sample_collected", has_result: true },
    ]);
    mockedValidateResult.mockResolvedValueOnce({
      id: "result-1",
      result_value: "Negative",
      is_abnormal: false,
      notes: "",
      performed_by_name: "Tech",
      validated_by_name: "Tech",
      validated_at: "2026-09-04T11:00:00Z",
      pending_validation: false,
      created_at: "",
    });

    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /validate/i }));

    await waitFor(() => expect(mockedValidateResult).toHaveBeenCalledWith("req-1"));
  });
});
