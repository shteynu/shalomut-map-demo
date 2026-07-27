import unittest
from src.contracts import (
    AI_ANALYTICS_V5_CONTRACT_VERSION,
    AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS,
    AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS,
)


class TestContractV5(unittest.TestCase):
    def test_version_constants(self):
        self.assertEqual(AI_ANALYTICS_V5_CONTRACT_VERSION, "5.0")
        self.assertIn("5.0", AI_ANALYTICS_SUPPORTED_CONTRACT_VERSIONS)
        self.assertIn("5.0", AI_ANALYTICS_DYNAMIC_CONTRACT_VERSIONS)


if __name__ == "__main__":
    unittest.main()
