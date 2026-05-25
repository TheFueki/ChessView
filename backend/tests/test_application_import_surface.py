import importlib
import pkgutil


def iter_application_modules():
    for package_name in ("app", "domains", "infrastructure", "shared"):
        package = importlib.import_module(package_name)
        yield package_name
        for module in pkgutil.walk_packages(package.__path__, prefix=f"{package_name}."):
            yield module.name


def test_all_application_modules_import_without_side_effect_errors():
    failed_imports: dict[str, str] = {}

    for module_name in iter_application_modules():
        try:
            importlib.import_module(module_name)
        except Exception as exc:  # pragma: no cover - assertion reports module names.
            failed_imports[module_name] = f"{type(exc).__name__}: {exc}"

    assert failed_imports == {}
