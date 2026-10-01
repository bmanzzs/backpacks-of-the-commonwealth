# Version 0.1.0 verification

The release passed **40 browser-based checks** in headless Microsoft Edge: 25 engine regression cases and 15 UI integration flows. Desktop and mobile screenshots were also visually reviewed.

Engine coverage includes selection defaults and constraints, dependencies and flags, changing earlier choices, hidden pages, install exceptions, folder expansion, file renaming, case-insensitive paths, priorities and conflicts, missing and unverified sources, invalid XML, unsupported features, safe paths, XML ordering, numeric version comparisons, and structural diagnostics.

UI coverage includes direct `file://` startup, XML-only and complete-folder import, package images, choices and conditional pages, simulated dependencies, visual editing and additions, preservation of advanced XML rules, invalid XML recovery, XML/log/JSON downloads, new installer creation, schema-aware insertion order, local draft recovery, and responsive layout.

Tests verified that source sample files remained byte-for-byte unchanged, the app made no outbound network requests, and no browser JavaScript errors occurred during these flows.

This evidence covers the supplied synthetic fixtures and specified cases. It does not certify all real-world FOMOD packages, every browser, exact MO2/Vortex rendering, or equivalence to every manager's installation behavior. Test release packages in their intended mod manager as well.

Reproduce with the commands and optional test dependency described in README.md. The application itself has no runtime dependencies.
