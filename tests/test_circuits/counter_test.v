module counter_tb;

    reg clk, reset;

    reg [3:0] count;

    initial begin
        $dumpfile("counter_test.vcd");
        $dumpvars(0, counter_tb);

        clk = 0;
        reset = 1;

        #10 reset = 0;

        #100 $finish;
    end

    always #5 clk = ~clk;

endmodule