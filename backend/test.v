module design (
    input wire a,
    input wire b,
    output wire y
);
    assign y = a & b;
endmodule

module tb;
    reg a;
    reg b;
    wire y;

    design uut(
        .a(a),
        .b(b),
        .y(y)
    );

    initial begin
        $dumpfile("output.vcd");
        $dumpvars(0, tb);

        a=0; b=0; #10;
        a=0; b=1; #10;
        a=1; b=0; #10;
        a=1; b=1; #10;

        $finish;
    end
endmodule
