"""Face verification provider boundary."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FaceVerificationResult:
    status: str
    confidence: float | None
    reason: str | None


class LocalStubFaceVerificationProvider:
    """Local-only provider that simulates pass/fail/uncertain without raw media storage."""

    name = "local_stub"

    def verify(self, scenario: str | None) -> FaceVerificationResult:
        if scenario == "fail":
            return FaceVerificationResult("failed", 0.2, "local stub simulated failure")
        if scenario == "uncertain":
            return FaceVerificationResult("uncertain", 0.5, "local stub simulated uncertainty")
        return FaceVerificationResult("verified", 0.95, "local stub simulated pass")
