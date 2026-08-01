import ast
import os
import re
import sys


ALLOWED_FILES = (
    "src/contracts.py",
    "src/schemas/contract_registry.py",
    "src/schemas/mcp_types.py",
)
VERSION_IDENTIFIER = re.compile(
    r"^AI_ANALYTICS_(?:V\d+_|DYNAMIC_|SUPPORTED_)?CONTRACT_VERSIONS?$"
)


def _is_allowed_file(filepath):
    normalized = filepath.replace(os.sep, "/")
    return "tests/" in normalized or any(
        normalized.endswith(allowed) for allowed in ALLOWED_FILES
    )


def _contains_version_identifier(node):
    return any(
        isinstance(child, ast.Name)
        and VERSION_IDENTIFIER.match(child.id)
        for child in ast.walk(node)
    )


def check_python_source(source, filepath="<source>"):
    tree = ast.parse(source, filename=filepath)
    errors = []

    class Visitor(ast.NodeVisitor):
        def visit_Constant(self, node):
            if (
                isinstance(node.value, str)
                and re.fullmatch(r"[1-6]\.0", node.value)
                and int(node.value.split(".")[0]) >= 3
            ):
                errors.append(
                    f"{filepath}:{node.lineno}: literal '{node.value}' "
                    "found outside a contract boundary"
                )
            self.generic_visit(node)

        def visit_Compare(self, node):
            if _contains_version_identifier(node):
                errors.append(
                    f"{filepath}:{node.lineno}: contract-version branching "
                    "through a named constant"
                )
            for child in ast.walk(node):
                if (
                    isinstance(child, ast.Constant)
                    and isinstance(child.value, str)
                    and re.fullmatch(r"(?:1|2)\.0", child.value)
                ):
                    errors.append(
                        f"{filepath}:{node.lineno}: legacy contract-version "
                        f"branching on '{child.value}'"
                    )
            self.generic_visit(node)

    Visitor().visit(tree)
    return list(dict.fromkeys(errors))


def check_python_file(filepath):
    if _is_allowed_file(filepath):
        return []
    with open(filepath, "r", encoding="utf-8") as source_file:
        return check_python_source(source_file.read(), filepath)


def main():
    errors = []
    for root, _, files in os.walk("ai-analytics-service/src"):
        for filename in files:
            if filename.endswith(".py"):
                errors.extend(check_python_file(os.path.join(root, filename)))

    for error in errors:
        print(error)
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
