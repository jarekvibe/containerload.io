// Prädikat exakt wie an der Aufrufstelle: openDoors = (ci === chain.length - 1)
const openDoors = (ci, chainLen) => ci === chainLen - 1;

let pass = 0, fail = 0;
const ok = (cond, msg) => (cond ? pass++ : (fail++, console.error("FAIL:", msg)));

// 1) Einzelcontainer: Tür offen (Regression – Verhalten wie vor dem Fix)
ok(openDoors(0, 1) === true, "single container -> doors open");

// 2) Zwei Container: nur der letzte offen, der erste (glitchende) geschlossen
ok(openDoors(0, 2) === false, "chain2: container0 doors CLOSED (was the glitch)");
ok(openDoors(1, 2) === true,  "chain2: container1 (last) doors open");

// 3) Drei Container: nur der letzte offen
ok(openDoors(0, 3) === false, "chain3: c0 closed");
ok(openDoors(1, 3) === false, "chain3: c1 closed");
ok(openDoors(2, 3) === true,  "chain3: c2 (last) open");

// 4) Vier Container (MAXVIS): nur der letzte offen
ok(openDoors(3, 4) === true,  "chain4: last open");
ok([0,1,2].every(ci => openDoors(ci, 4) === false), "chain4: all but last closed");

// 5) Genau ein offener Container pro Kette (Invariante)
for (const n of [1,2,3,4]) {
  const openCount = Array.from({length: n}, (_, ci) => openDoors(ci, n)).filter(Boolean).length;
  ok(openCount === 1, `chain${n}: exactly one open-door container`);
}

// 6) Die Tuerblaetter selbst sind weg -- das Tuerende bleibt offen und gefasst.
//
// Gemeldet: "anfangs wollte ich die Containertuer in der 3D View drinne haben, jetzt nerven
// die mich irgendwie". Die zwei aufgeschwungenen Blaetter ragten ueber einen Meter ueber das
// Containerende hinaus, standen bei jeder Drehung als grosse Flaechen im Bild -- und
// vergroesserten den Rahmen, auf den die Kamera einpasst, sodass die Ladung kleiner
// gezeichnet wurde.
//
// Das Praedikat oben bleibt: es entscheidet weiterhin, welcher Container der Kette KEINE
// Stirnwand am Tuerende bekommt. Nur die Blaetter sind fort.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const app = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "app.html"), "utf8");
ok(!/DOOR_OPEN/.test(app), "die Tuerblaetter sind wieder da (DOOR_OPEN)");
ok(!/hingeL|hingeR|geoLeaf/.test(app), "Scharniere oder Blattgeometrie sind wieder da");
// Und die Gegenprobe: das Tuerende ist weiterhin OFFEN und traegt seine Rahmenkante.
ok(/if \(kind === "dry" && openDoors\) \{/.test(app), "der Zweig fuer das offene Tuerende fehlt");
ok(/frameEdge\.position\.set\(CL, cy, cz\)/.test(app), "die Rahmenkante am Tuerende fehlt");
ok(/if \(kind !== "dry" \|\| !openDoors\)/.test(app), "die flache Stirnwand der uebrigen Container fehlt");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
