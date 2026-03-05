import * as XLSX from "xlsx";

const data = [
  { playerId: 8478402, fullName: "Connor McDavid" },
  { playerId: 8478420, fullName: "Mikko Rantanen" },
];

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(data);
XLSX.utils.book_append_sheet(workbook, worksheet, "Players");
XLSX.writeFile(workbook, "data/players.xlsx");

console.log("Created data/players.xlsx");
