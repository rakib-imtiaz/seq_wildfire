# Sequoia Security Wildfire: facts file

This is the single source of truth for copy. Every claim on the site must trace to a line here. If something isn't here, it doesn't go on the site; use `[TK]` and ask.

## 1. The brief, verbatim

Source: `C:\Users\USER\Downloads\Document(1) (1).PDF`. Em dashes from the brief are kept here as written; on the site they become colons or commas.

**SEQUOIA SECURITY**
**Drone-Enhanced Wildfire Monitoring & Fire Watch Services**
**Tagline: Beyond Traditional Fire Watch. Intelligence From Above.**

### Service Overview
Sequoia Security is developing a next-generation wildfire monitoring and fire watch service designed for utility companies, hydroelectric facilities, energy infrastructure, forestry operations, and remote industrial sites throughout British Columbia.

Traditional fire watch services rely primarily on security personnel conducting ground-level patrols, visually identifying smoke or fire, and reporting potential hazards.

**Our approach takes fire watch operations beyond ground-level observation.**

Under our proposed deployment model, every designated fire watch security guard will also be trained and certified as a Transport Canada Advanced Operations drone pilot and equipped with a DJI Mavic 3 Thermal (M3T) enterprise drone.

Combining ground patrols with aerial thermal imaging, our personnel will be able to inspect designated monitoring areas, identify potential heat anomalies, document fire-related hazards, and provide geographically referenced information to incident coordinators.

The objective is to transform conventional fire watch services into a technology-enabled wildfire intelligence operation.

### Our Core Services
1. **Advanced Fire Watch & Ground Security.** Trained security personnel conduct scheduled patrols, observe potential ignition sources, monitor high-risk areas, and document site conditions. Personnel follow established reporting and emergency escalation procedures.
2. **Thermal Drone Surveillance.** Using DJI Mavic 3 Thermal drones, authorized operators conduct aerial monitoring of designated areas. Thermal imaging supports identification of potential hotspots, abnormal heat signatures, and areas requiring closer inspection.
3. **Interactive Wildfire Mapping.** Captured drone imagery and georeferenced field observations are integrated into a digital mapping platform. The platform is intended to visualize:
   - Potential fire hotspots and detected thermal anomalies.
   - Observed or estimated fire-affected areas.
   - Locations of critical infrastructure and assets.
   - Security patrol and drone observation locations.
   - Changes in observed fire conditions over time.
   - Areas requiring additional monitoring or immediate escalation.

   Maps are updated as new verified observations and processed imagery become available, providing near-real-time situational awareness where operational connectivity permits.
4. **Live Aerial Situational Awareness.** Where authorized and technically supported, drone operators can transmit live camera footage to designated monitoring personnel. This provides an additional aerial perspective to assist with field coordination, risk assessment, and operational decision-making.
5. **Emergency Documentation & Reporting.** Each monitoring operation can generate structured reports containing flight records, thermal observations, geotagged imagery, incident locations, timestamps, and follow-up recommendations. These records support communication, incident review, risk assessment, and seasonal wildfire monitoring documentation.

### How Our Service Works
- **Step 1, Ground Monitoring:** Security personnel conduct routine patrols and assess potential fire hazards across designated facilities and surrounding areas.
- **Step 2, Aerial Inspection:** Where legally permitted and operationally safe, certified drone pilots deploy thermal-equipped aircraft to inspect areas of concern.
- **Step 3, Thermal Detection:** Drone cameras capture visible-light and thermal imagery to identify potential heat signatures and document observable fire-related conditions.
- **Step 4, Digital Mapping:** Observations are geotagged and incorporated into a centralized geographic monitoring dashboard.
- **Step 5, Reporting & Coordination:** Verified information is shared with authorized client representatives and relevant emergency authorities through established procedures.

### Designed for Critical Infrastructure
Our proposed service is particularly suited for organizations operating infrastructure in remote, forested, or wildfire-prone environments. Potential applications include:
- Hydroelectric dams, generating stations, and associated infrastructure.
- Transmission corridors and electrical substations.
- Remote utility facilities and construction projects.
- Industrial operations near forested areas.
- Forestry assets and other high-risk properties.

### Why Sequoia Security?
**Traditional fire watch observes. Sequoia Security is designed to observe, detect, map, and report.**

By combining physical security, aerial thermal inspection, and geospatial intelligence, our proposed service aims to deliver:
- Expanded visibility of designated monitoring areas.
- Faster investigation of potential fire hazards.
- Better documentation of thermal anomalies.
- Location-specific mapping and incident reporting.
- Enhanced situational awareness for infrastructure operators.
- One integrated field team instead of separately contracted security and drone monitoring personnel.

### Our Commitment
Sequoia Security aims to provide utility and industrial clients with a practical, scalable wildfire monitoring solution that combines human judgment, professional security operations, advanced aerial technology, and geospatial data.

All drone operations will be subject to Transport Canada requirements, applicable airspace restrictions, site permissions, and coordination with the appropriate wildfire authorities.

**Sequoia Security: Protecting Critical Infrastructure From the Ground and the Sky.**

**Call to Action: Request a Wildfire Monitoring Proposal**

## 2. Business details

| Item | Value | Source / status |
|---|---|---|
| Name | Sequoia Security | brief |
| Address | 293 Arrowstone Drive, Kamloops, BC V2C 1P8 | business card (`seq_security/old_site_code/.../project_resources/Sequoia Security.jpg`) |
| Phone | 250-879-6055 (`tel:+12508796055`) | business card |
| Email | **[TK]**, unconfirmed (the card shows `sequoiasecurity@email.com`; don't use it until the client confirms) | TODO:client |
| Main site | sequoiasecurity.ca (guarding services; link out) | business card |
| Licence / insurance numbers | **none given; never invent** | TODO:client |
| Logo | The original teal "SEQUOIA SECURITY" wordmark (`project_resources/*.eps/.jpg`) is the default; open question for the user | TODO:user |

## 3. DJI Mavic 3 Thermal (M3T): verified specs

Source: DJI's official spec page, enterprise.dji.com/mavic-3-enterprise/specs (read 2026-10-16). Use only these.

**Aircraft:**
- 920 g with propellers, without accessories.
- Max take-off weight 1050 g.
- Unfolded 347.5 × 283 × 107.7 mm without propellers; folded 221 × 96.3 × 90.3 mm.
- Max flight time 45 min (standard battery, no wind); max hover 38 min.
- Max speed 15 m/s normal, 21 m/s sport forward.
- Max ascent 6 m/s normal.
- Wind resistance 12 m/s (take-off and landing).
- Operating temperature −10 to 40 °C.

**Cameras:**

| Camera | Specs |
|---|---|
| Thermal | Uncooled VOx microbolometer, 640 × 512, 12 μm pixel pitch, 30 Hz, DFOV 61°, 40 mm equivalent, f/1.0, NETD ≤ 50 mK. Measures −20 to 150 °C (high gain) and 0 to 500 °C (low gain); accuracy ±2 °C or ±2% (high gain). Spot and area measurement. 28× digital zoom. Palettes include White Hot, Black Hot, Iron Red, Hot Iron, Arctic and others |
| Wide | 1/2-inch CMOS, 48 MP, 24 mm equivalent, FOV 84°, f/2.8 |
| Tele | 1/2-inch CMOS, 12 MP, 162 mm equivalent, FOV 15°, up to 56× hybrid zoom |

**Other:**
- **RTK:** an optional module (1 cm + 1 ppm horizontal fix). Only claim it if the client confirms they'll fit it.
- **Transmission:** O3 Enterprise; latency about 200 ms. Don't quote range figures on the site, because they depend on region and conditions.
- **Not on the M3T:** a laser rangefinder. Never claim one.

## 4. Transport Canada

The brief says "Transport Canada Advanced Operations" pilot certificate. State it as a certification the guards *will* hold. No TC logos. Don't add regulatory detail beyond the brief unless it's sourced and added here first.

## 5. Honesty rules (from the `seq_security` project, plus this brief)

1. **Proposal-led.** The service is being developed. Use the brief's verbs: "designed to", "will", "aims to", "where authorized", "where legally permitted and operationally safe", "where operational connectivity permits".
2. **No invented numbers, clients, case studies, testimonials, response times, coverage areas, licence numbers or insurance.**
3. **Every demo readout, map, timestamp, temperature and report is SAMPLE data from a fictional watch zone, and is labelled that way on screen.**
4. **Never name a wildfire authority as a partner.** Write "the appropriate wildfire authorities".
5. **No em dashes in site copy.**
6. No DJI or Transport Canada logos. The model name and certificate name as plain text only.
7. The guarding services (patrol, alarms and so on) live on sequoiasecurity.ca. This site only links there.
