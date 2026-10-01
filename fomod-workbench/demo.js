/* Original demonstration package. All listed assets are simulation fixtures. */
(function () {
  'use strict';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 720" role="img" aria-label="Original expedition pack schematic">
  <defs>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#263434" stroke-width="1"/></pattern>
    <linearGradient id="canvas" x1="0" x2="1" y2="1"><stop stop-color="#87916f"/><stop offset="1" stop-color="#525d48"/></linearGradient>
    <linearGradient id="flap" x1="0" x2="0" y2="1"><stop stop-color="#a4ac84"/><stop offset="1" stop-color="#788260"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#050a08" flood-opacity=".6"/></filter>
  </defs>
  <rect width="960" height="720" fill="#172322"/><rect width="960" height="720" fill="url(#grid)"/>
  <g fill="none" stroke="#718580" opacity=".3"><circle cx="475" cy="346" r="264"/><circle cx="475" cy="346" r="210"/><path d="M475 40V653M140 346H815" stroke-dasharray="4 10"/></g>
  <g font-family="monospace" fill="#82958d" font-size="13" letter-spacing="3"><text x="48" y="48">TRAILBOUND / FIELD SYSTEMS</text><text x="48" y="680">PACK 01 / EXPEDITION SERIES</text><text x="758" y="680">VOL. 38 L</text></g>
  <g filter="url(#shadow)">
    <path d="M385 146V103Q386 78 420 80H527Q560 80 560 107V151" fill="none" stroke="#354337" stroke-width="28"/><path d="M386 146V103Q386 83 421 83H525Q554 83 554 107V151" fill="none" stroke="#687452" stroke-width="8"/>
    <rect x="287" y="221" width="66" height="279" rx="28" fill="#3b493b" stroke="#111c19" stroke-width="5"/><rect x="600" y="221" width="66" height="279" rx="28" fill="#3b493b" stroke="#111c19" stroke-width="5"/>
    <path d="M332 177Q348 145 383 145H569Q604 146 621 181L624 542Q615 583 573 587H379Q335 584 329 544Z" fill="url(#canvas)" stroke="#17251f" stroke-width="5"/>
    <path d="M346 191V526Q352 561 383 565H568Q601 561 606 533V191" fill="none" stroke="#b4ba90" stroke-width="2" stroke-dasharray="5 7" opacity=".5"/>
    <rect x="326" y="146" width="300" height="151" rx="40" fill="url(#flap)" stroke="#27372b" stroke-width="5"/>
    <path d="M344 190V245Q348 272 378 276H574Q605 272 607 245V190" fill="none" stroke="#cad0a4" stroke-width="2" stroke-dasharray="5 7" opacity=".6"/>
    <rect x="362" y="306" width="228" height="216" rx="25" fill="#697555" stroke="#34452f" stroke-width="4"/>
    <path d="M371 332H581M371 346H581" stroke="#293a2d" stroke-width="5"/><rect x="381" y="325" width="11" height="30" rx="3" fill="#d4bd85"/>
    <path d="M393 259V553M559 259V553" stroke="#334632" stroke-width="23"/>
    <path d="M393 260V551M559 260V551" stroke="#899774" stroke-width="2" stroke-dasharray="5 6"/>
    <g fill="#1e2f26" stroke="#bdad7e" stroke-width="3"><rect x="377" y="283" width="32" height="41" rx="5"/><rect x="543" y="283" width="32" height="41" rx="5"/></g>
    <g stroke="#bbae83" stroke-width="3"><path d="M380 300H406M546 300H572"/></g>
    <rect x="430" y="370" width="92" height="72" rx="6" fill="#c8a362" stroke="#323f2f" stroke-width="4"/>
    <path d="M442 423L462 393L474 408L486 386L511 423Z" fill="#374635"/><path d="M449 425H506" stroke="#f2d89e" stroke-width="2"/>
    <path d="M365 478H588M365 492H588" stroke="#414f38" stroke-width="6"/>
    <rect x="251" y="304" width="76" height="126" rx="21" fill="#a78956" stroke="#27372a" stroke-width="4"/><path d="M258 339H320M258 390H320" stroke="#46583c" stroke-width="15"/>
    <rect x="630" y="294" width="52" height="167" rx="21" fill="#8f9e94" stroke="#263b31" stroke-width="4"/><rect x="641" y="278" width="30" height="26" rx="6" fill="#394c40"/><path d="M631 364H682" stroke="#42543f" stroke-width="18"/>
    <rect x="345" y="543" width="265" height="61" rx="27" fill="#857e5d" stroke="#283b2d" stroke-width="4"/><path d="M388 545V602M565 545V602" stroke="#304932" stroke-width="18"/>
  </g>
  <g fill="none" stroke="#b8c5ad" stroke-width="1.5" opacity=".8"><path d="M615 189H749L775 163H849"/><circle cx="615" cy="189" r="4"/><path d="M292 381H183L158 408H83"/><circle cx="292" cy="381" r="4"/><path d="M573 573H749L777 602H852"/><circle cx="573" cy="573" r="4"/></g>
  <g fill="#c2c8b5" font-family="monospace" font-size="13" letter-spacing="1"><text x="758" y="149">WEATHER SHELL</text><text x="72" y="433">FIELD UTILITY</text><text x="748" y="626">MODULAR CARRY</text></g>
  </svg>`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<config xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://qconsulting.ca/fo3/ModConfig5.0.xsd">
  <moduleName>Trailbound • Field Kit</moduleName>
  <moduleImage path="fomod\\images\\field-kit.svg" showImage="true" showFade="false" />
  <requiredInstallFiles>
    <file source="Core\\Trailbound.esp" destination="Trailbound.esp" priority="0" />
    <folder source="Core\\Meshes" destination="meshes\\Trailbound" priority="0" />
  </requiredInstallFiles>
  <installSteps order="Explicit">
    <installStep name="Texture quality">
      <optionalFileGroups order="Explicit">
        <group name="Choose your texture resolution" type="SelectExactlyOne">
          <plugins order="Explicit">
            <plugin name="2K · Balanced">
              <description>Sharp canvas, worn brass, and stitched webbing. A balanced texture set for everyday adventures. This fictional package is a safe simulation fixture.</description>
              <image path="fomod\\images\\field-kit.svg" />
              <files><folder source="Textures\\2K" destination="textures\\Trailbound" priority="10" /></files>
              <conditionFlags><flag name="quality">2k</flag></conditionFlags>
              <typeDescriptor><type name="Recommended" /></typeDescriptor>
            </plugin>
            <plugin name="4K · Extra detail">
              <description>Higher resolution fabric and hardware for close-up screenshots. Select this to see the planned texture sources change.</description>
              <image path="fomod\\images\\field-kit.svg" />
              <files><folder source="Textures\\4K" destination="textures\\Trailbound" priority="10" /></files>
              <conditionFlags><flag name="quality">4k</flag></conditionFlags>
              <typeDescriptor><type name="Optional" /></typeDescriptor>
            </plugin>
          </plugins>
        </group>
      </optionalFileGroups>
    </installStep>
    <installStep name="Optional extras">
      <optionalFileGroups order="Explicit">
        <group name="Make it yours" type="SelectAny">
          <plugins order="Explicit">
            <plugin name="Weathered appearance">
              <description>Trade the fresh field finish for a well-traveled look. Enables a third page where you can choose the weathering tone.</description>
              <image path="fomod\\images\\field-kit.svg" />
              <conditionFlags><flag name="weathered">true</flag></conditionFlags>
              <typeDescriptor><type name="Optional" /></typeDescriptor>
            </plugin>
            <plugin name="Companion compatibility patch">
              <description>Demonstrates a mod dependency. Set CompanionMod.esp to Active in the simulated environment to make this patch available.</description>
              <files><file source="Patches\\Trailbound-Companion.esp" destination="Trailbound-Companion.esp" priority="20" /></files>
              <typeDescriptor>
                <dependencyType>
                  <defaultType name="NotUsable" />
                  <patterns><pattern><dependencies operator="And"><fileDependency file="CompanionMod.esp" state="Active" /></dependencies><type name="Recommended" /></pattern></patterns>
                </dependencyType>
              </typeDescriptor>
            </plugin>
          </plugins>
        </group>
      </optionalFileGroups>
    </installStep>
    <installStep name="Weathering tone">
      <visible><flagDependency flag="weathered" value="true" /></visible>
      <optionalFileGroups order="Explicit">
        <group name="Choose a field finish" type="SelectExactlyOne">
          <plugins order="Explicit">
            <plugin name="Amber · Sun worn">
              <description>Sun-faded canvas with warm dust. Its priority of 30 supersedes the base color texture at priority 10, while retaining the selected normal map.</description>
              <image path="fomod\\images\\field-kit.svg" />
              <files><file source="Weathered\\Amber.dds" destination="textures\\Trailbound\\pack_d.dds" priority="30" /></files>
              <typeDescriptor><type name="Recommended" /></typeDescriptor>
            </plugin>
            <plugin name="Charcoal · Storm worn">
              <description>Cool soot and rain-darkened fabric. This alternate color also demonstrates priority-based replacement in the installation plan.</description>
              <image path="fomod\\images\\field-kit.svg" />
              <files><file source="Weathered\\Charcoal.dds" destination="textures\\Trailbound\\pack_d.dds" priority="30" /></files>
              <typeDescriptor><type name="Optional" /></typeDescriptor>
            </plugin>
          </plugins>
        </group>
      </optionalFileGroups>
    </installStep>
  </installSteps>
</config>`;

  const files = [
    { path: 'Core/Trailbound.esp', size: 16384 },
    { path: 'Core/Meshes/field-pack.nif', size: 612352 },
    { path: 'Textures/2K/pack_d.dds', size: 2796336 },
    { path: 'Textures/2K/pack_n.dds', size: 5592544 },
    { path: 'Textures/4K/pack_d.dds', size: 11184944 },
    { path: 'Textures/4K/pack_n.dds', size: 22369664 },
    { path: 'Patches/Trailbound-Companion.esp', size: 8192 },
    { path: 'Weathered/Amber.dds', size: 2796336 },
    { path: 'Weathered/Charcoal.dds', size: 2796336 },
    { path: 'fomod/ModuleConfig.xml', size: new TextEncoder().encode(xml).length },
    { path: 'fomod/info.xml', size: 271 },
    { path: 'fomod/images/field-kit.svg', size: new TextEncoder().encode(svg).length }
  ];
  window.FomodDemo = {
    xml,
    files,
    images: { 'fomod\\images\\field-kit.svg': 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) },
    note: 'Fictional package. Built-in file sizes are illustrative; sample-package contains text fixtures, not working game assets.'
  };
})();
