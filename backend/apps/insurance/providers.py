"""Insurance provider integration seam (CLAUDE.md section 4).

There is no public NHIS claims API, so this is a mock implementation only —
nothing here calls, or fabricates, a real NHIS endpoint or response schema.
A future real integration implements InsuranceProviderInterface and swaps
in via get_provider() without touching any calling code.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class EligibilityResult:
    eligible: bool
    provider_reference: str
    message: str


class InsuranceProviderInterface(ABC):
    @abstractmethod
    def check_eligibility(self, member_id: str) -> EligibilityResult:
        ...


class MockNHISProvider(InsuranceProviderInterface):
    """Mock, pending real integration. Deterministic so it's testable: any
    plausible-looking member_id (5+ characters) is reported eligible."""

    def check_eligibility(self, member_id: str) -> EligibilityResult:
        eligible = bool(member_id) and len(member_id.strip()) >= 5
        return EligibilityResult(
            eligible=eligible,
            provider_reference=f"MOCK-{member_id or 'UNKNOWN'}",
            message=(
                "Mock eligibility check — pending real NHIS integration."
                if eligible
                else "Mock check: member ID too short to be a plausible NHIS number."
            ),
        )


def get_provider(provider_type: str) -> InsuranceProviderInterface:
    if provider_type == "nhis":
        return MockNHISProvider()
    raise NotImplementedError(
        f"No electronic verification is configured for '{provider_type}'. Private "
        "insurers are recorded but not electronically verified (CLAUDE.md section 4)."
    )
