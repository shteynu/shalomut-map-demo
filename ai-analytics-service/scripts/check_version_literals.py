import ast
import os
import sys

def check_python_file(filepath):
    with open(filepath, 'r') as f:
        tree = ast.parse(f.read(), filename=filepath)
    
    errors = []
    
    class Visitor(ast.NodeVisitor):
        def visit_Constant(self, node):
            if isinstance(node.value, str):
                if node.value in ("3.0", "4.0", "5.0", "6.0"):
                    # allowlist registry and tests
                    if "contract_registry" not in filepath and "tests/" not in filepath:
                        errors.append(f"{filepath}:{node.lineno}: literal '{node.value}' found outside registry")
            self.generic_visit(node)
            
        def visit_Compare(self, node):
            self.generic_visit(node)

    Visitor().visit(tree)
    return errors

def main():
    has_errors = False
    for root, _, files in os.walk('ai-analytics-service/src'):
        for file in files:
            if file.endswith('.py'):
                path = os.path.join(root, file)
                errors = check_python_file(path)
                for e in errors:
                    print(e)
                    has_errors = True
                    
    if has_errors:
        sys.exit(1)

if __name__ == "__main__":
    main()
